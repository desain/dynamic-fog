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

type DoorIntersection = PathIntersection & { world: Vector2 };

let startId: string | null = null;
let endId: string | null = null;
let subpathId: string | null = null;
let target: { id: string; skPath: SkPath; item: Drawing } | null = null;
let startHit: DoorIntersection | null = null;
let endHit: DoorIntersection | null = null;

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
      start,
      end
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
      if (!hit || hit.contourIndex !== startHit.contourIndex) {
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
        toDelete.push(subpathId);
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
      if (startId) {
        OBR.scene.local.deleteItems([startId]);
      }
      startId = null;
      target?.skPath.delete();
      target = null;
    },
    cursors: [
      {
        cursor: "crosshair",
        filter: {},
      },
    ],
  });
}
