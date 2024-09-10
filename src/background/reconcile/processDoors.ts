import { Drawing } from "../../types/Drawing";
import { CanvasKit, Path as SkPath } from "canvaskit-wasm";
import { Door } from "../../types/Door";
import { getMetadata } from "../util/getMetadata";
import { getPluginId } from "../util/getPluginId";
import { PathHelpers } from "../util/PathHelpers";
import { MathM } from "@owlbear-rodeo/sdk";
import { getDrawing } from "./reconcile";

interface DoorPath {
  base: Door;
  // Current stroked door in world space
  skPath: SkPath;
  parent: string;
}

// A mapping of parent IDs to doors attached to those parents
let prevDoors: Record<string, DoorPath[]> = {};

export function processDoors(
  addedDrawings: Drawing[],
  deletedDrawings: Set<string>,
  updatedDrawings: Drawing[],
  CanvasKit: CanvasKit
) {
  const deletedDoors: DoorPath[] = [];
  for (const id of deletedDrawings) {
    if (id in prevDoors) {
      const doors = prevDoors[id];
      deletedDoors.push(...doors);

      // Delete door paths
      for (const visual of doors) {
        visual.skPath.delete();
      }
    }
    delete prevDoors[id];
  }

  const addedDoors: DoorPath[] = [];
  for (const drawing of addedDrawings) {
    const doors = drawingToDoorPaths(drawing, CanvasKit);
    addedDoors.push(...doors);
    prevDoors[drawing.id] = doors;
  }

  const updatedDoors: DoorPath[] = [];
  const doorUpdates: Door[] = [];
  for (const drawing of updatedDrawings) {
    if (!(drawing.id in prevDoors)) {
      continue;
    }
    const doors = prevDoors[drawing.id];
    const nextDoors = getMetadata<Door[]>(
      drawing.metadata,
      getPluginId("doors"),
      []
    );

    if (doors.length < nextDoors.length) {
      // Need to add more doors as there are new ones
      for (let i = doors.length; i < nextDoors.length; i++) {
        const door = nextDoors[i];
        const visual = doorToDoorPath(drawing, CanvasKit, door);
        if (visual) {
          doors.push(visual);
          addedDoors.push(visual);
        }
      }
    } else if (doors.length > nextDoors.length) {
      // Need to remove doors as there are less
      const numRemoved = doors.length - nextDoors.length;
      const toDelete = doors.splice(doors.length - numRemoved, numRemoved);
      deletedDoors.push(...toDelete);

      // Delete door paths
      for (const visual of toDelete) {
        visual.skPath.delete();
      }
    }

    // Update remaining doors
    for (let i = 0; i < doors.length; i++) {
      const door = doors[i];
      const nextDoor = nextDoors[i];
      updatedDoors.push(door);
      doorUpdates.push(nextDoor);

      // Update door values
      door.base = nextDoor;
      const drawing = getDrawing(door.parent);
      const nextSkPath = drawing && getDoorSkPath(drawing, CanvasKit, nextDoor);
      if (nextSkPath) {
        door.skPath.delete();
        door.skPath = nextSkPath;
      }
    }
  }
}

export function resetDoors() {
  for (const doors of Object.values(prevDoors)) {
    for (const door of doors) {
      door.skPath.delete();
    }
  }
  prevDoors = {};
}

export function getDoorSkPaths() {
  return Object.values(prevDoors)
    .flat()
    .map((visual) => visual.skPath);
}

function drawingToDoorPaths(
  drawing: Drawing,
  CanvasKit: CanvasKit
): DoorPath[] {
  const visuals: DoorPath[] = [];
  const doors = getMetadata<Door[]>(drawing.metadata, getPluginId("doors"), []);
  for (const door of doors) {
    const visual = doorToDoorPath(drawing, CanvasKit, door);
    if (!visual) {
      continue;
    }
    visuals.push(visual);
  }
  return visuals;
}

function doorToDoorPath(
  drawing: Drawing,
  CanvasKit: CanvasKit,
  door: Door
): DoorPath | null {
  const skPath = getDoorSkPath(drawing, CanvasKit, door);
  if (!skPath) {
    return null;
  }
  return {
    base: door,
    skPath: skPath,
    parent: drawing.id,
  };
}

function getDoorSkPath(drawing: Drawing, CanvasKit: CanvasKit, door: Door) {
  const skPath = PathHelpers.drawingToSkPath(drawing, CanvasKit);
  if (!skPath) {
    return null;
  }
  const segment = PathHelpers.getSkPathBetween(
    CanvasKit,
    skPath,
    door.start,
    door.end
  );
  skPath.delete();
  if (!segment) {
    return null;
  }
  segment.stroke({
    // TODO: Use grid stroke width instead
    // TODO: Check with zero width
    // Add a buffer to account for the segmentation of curves
    width: drawing.style.strokeWidth + 1,
  });

  // Transform segment into world space
  const transform = MathM.fromItem(drawing);
  segment.transform(...transform);

  return segment;
}
