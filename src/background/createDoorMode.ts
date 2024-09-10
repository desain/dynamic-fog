import OBR, {
  buildPath,
  buildShape,
  isPath,
  MathM,
  Path,
  ToolEvent,
  Vector2,
} from "@owlbear-rodeo/sdk";
import { Drawing, isDrawing } from "./drawing";
import { CanvasKit, Path as SkPath } from "canvaskit-wasm";
import { PathHelpers, PathIntersection } from "./util/PathHelpers";
import { inverseTransformPoint, transformPoint } from "./util/math";
import { getPluginId } from "./util/getPluginId";
import { Door } from "./door";
import { getMetadata } from "./util/getMetadata";

type DoorIntersection = PathIntersection & { world: Vector2 };

let startId: string | null = null;
let endId: string | null = null;
let subpathId: string | null = null;
let target: { id: string; skPath: SkPath; item: Drawing } | null = null;
let startHit: DoorIntersection | null = null;
let endHit: DoorIntersection | null = null;
let wallVisuals: string[] = [];

export function createDoorMode(CanvasKit: CanvasKit) {
  function getIntersection(pointerPosition: Vector2): DoorIntersection | null {
    if (!target) {
      return null;
    }

    const transform = MathM.fromItem(target.item);
    const intersection = PathHelpers.getSkPathIntersection(
      CanvasKit,
      target.skPath,
      inverseTransformPoint(transform, pointerPosition)
    );
    return {
      ...intersection,
      world: transformPoint(transform, intersection.point),
    };
  }

  function createControlPoint(position: Vector2) {
    return buildShape()
      .position(position)
      .width(24)
      .height(24)
      .shapeType("CIRCLE")
      .fillColor("#ff7433")
      .strokeColor("#ff7433")
      .layer("CONTROL")
      .disableHit(true)
      .build();
  }

  function createSubpath(parent: Drawing) {
    return buildPath()
      .position(parent.position)
      .rotation(parent.rotation)
      .scale(parent.scale)
      .fillOpacity(0)
      .strokeWidth(parent.style.strokeWidth)
      .strokeColor("#ff7433")
      .layer("CONTROL")
      .disableHit(true)
      .build();
  }

  async function createOrUpdateStart(event: ToolEvent) {
    if (
      event.target &&
      event.target.layer === "FOG" &&
      isDrawing(event.target)
    ) {
      // Create or update target path if needed
      if (!target || event.target.id !== target.id) {
        target?.skPath.delete();
        const skPath = PathHelpers.drawingToSkPath(event.target, CanvasKit);
        target = skPath
          ? {
              id: event.target.id,
              skPath: skPath,
              item: event.target,
            }
          : null;
      }

      const hit = getIntersection(event.pointerPosition);
      if (!hit) {
        return;
      }

      if (startId) {
        await OBR.scene.local.updateItems(
          [startId],
          (items) => {
            for (const item of items) {
              item.position = hit.world;
            }
          },
          true
        );
      } else {
        const start = createControlPoint(hit.world);
        startId = start.id;
        await OBR.scene.local.addItems([start]);
      }

      startHit = hit;
    } else if (startId) {
      // No target so delete the starting indicator
      await OBR.scene.local.deleteItems([startId]);
      startId = null;
      target?.skPath.delete();
      target = null;
    }
  }

  function updateSubpathCommands(
    path: Path,
    skPath: SkPath,
    start: DoorIntersection,
    end: DoorIntersection
  ) {
    const commands = PathHelpers.getCommandsBetween(
      CanvasKit,
      skPath,
      start.contour,
      end.contour
    );
    if (commands) {
      path.commands = commands;
    }
  }

  OBR.tool.createMode({
    id: getPluginId("door-mode"),
    icons: [
      {
        icon: "/icon.svg",
        label: "Door",
        filter: {
          activeTools: ["rodeo.owlbear.tool/fog"],
        },
      },
    ],
    async onToolMove(_, event) {
      if (!endId) {
        await createOrUpdateStart(event);
      }
    },
    async onToolDragStart(_, event) {
      await createOrUpdateStart(event);

      if (!startId || !target) {
        return;
      }

      const hit = getIntersection(event.pointerPosition);
      if (!hit) {
        return;
      }

      endHit = hit;
      const end = createControlPoint(hit.world);
      endId = end.id;
      const subpath = createSubpath(target.item);
      subpathId = subpath.id;
      await OBR.scene.local.addItems([end, subpath]);
    },
    async onToolDragMove(_, event) {
      if (!endId || !target || !startHit || !subpathId) {
        return;
      }

      const hit = getIntersection(event.pointerPosition);
      // Prevent movement if changing between shape contours
      if (!hit || hit.contour.index !== startHit.contour.index) {
        return;
      }

      endHit = hit;

      await OBR.scene.local.updateItems([endId, subpathId], (items) => {
        for (const item of items) {
          if (item.id === endId) {
            item.position = hit.world;
          } else if (
            item.id === subpathId &&
            isPath(item) &&
            target &&
            startHit &&
            endHit
          ) {
            updateSubpathCommands(item, target.skPath, startHit, endHit);
          }
        }
      });
    },
    async onToolDragEnd() {
      const toDelete: string[] = [];
      if (endId) {
        toDelete.push(endId);
      }
      if (subpathId) {
        wallVisuals.push(subpathId);
      }
      if (target && startHit && endHit) {
        const start = startHit.contour;
        const end = endHit.contour;
        OBR.scene.items.updateItems([target.item], (items) => {
          const item = items[0];
          if (item) {
            const metadata: Door[] | undefined =
              item.metadata[getPluginId("doors")];
            if (metadata && Array.isArray(metadata)) {
              metadata.push({ open: true, start, end });
            } else {
              item.metadata[getPluginId("doors")] = [
                { open: true, start, end },
              ];
            }
          }
        });
      }
      OBR.scene.local.deleteItems(toDelete);
      endId = null;
      subpathId = null;
    },
    async onToolDragCancel() {
      const toDelete: string[] = [];
      if (endId) {
        toDelete.push(endId);
      }
      if (subpathId) {
        toDelete.push(subpathId);
      }
      OBR.scene.local.deleteItems(toDelete);
      endId = null;
      subpathId = null;
    },
    async onDeactivate() {
      const toDelete: string[] = [...wallVisuals];
      if (endId) {
        toDelete.push(endId);
      }
      if (subpathId) {
        toDelete.push(subpathId);
      }
      OBR.scene.local.deleteItems(toDelete);
      wallVisuals = [];
      startId = null;
      target?.skPath.delete();
      target = null;
    },
    async onActivate() {
      const allDrawings = await OBR.scene.items.getItems(
        (item): item is Drawing => item.layer === "FOG" && isDrawing(item)
      );
      const doorPaths: Path[] = [];
      for (const drawing of allDrawings) {
        const doors = getMetadata<Door[]>(
          drawing.metadata,
          getPluginId("doors"),
          []
        );
        if (doors.length === 0) {
          continue;
        }
        const skPath = PathHelpers.drawingToSkPath(drawing, CanvasKit);
        if (!skPath) {
          continue;
        }
        for (const door of doors) {
          const commands = PathHelpers.getCommandsBetween(
            CanvasKit,
            skPath,
            door.start,
            door.end
          );
          if (!commands) {
            continue;
          }
          const subpath = createSubpath(drawing);
          subpath.commands = commands;
          doorPaths.push(subpath);
          wallVisuals.push(subpath.id);
        }
      }
      if (doorPaths.length > 0) {
        await OBR.scene.local.addItems(doorPaths);
      }
    },
    cursors: [
      {
        cursor: "crosshair",
        filter: {},
      },
    ],
  });
}
