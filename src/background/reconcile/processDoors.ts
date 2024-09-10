import { Drawing } from "../drawing";
import { CanvasKit, Path as SkPath } from "canvaskit-wasm";
import { Door } from "../door";
import { getMetadata } from "../util/getMetadata";
import { getPluginId } from "../util/getPluginId";
import { PathHelpers } from "../util/PathHelpers";
import { isShape } from "@owlbear-rodeo/sdk";

interface VisualDoor {
  base: Door;
  skPath: SkPath;
  parent: string;
}

let prevDoors: Record<string, VisualDoor[]> = {};

export function processDoors(
  addedDrawings: Drawing[],
  deletedDrawings: Set<string>,
  updatedDrawings: Drawing[],
  CanvasKit: CanvasKit
): [VisualDoor[], VisualDoor[], VisualDoor[], Door[]] {
  const deletedDoors: VisualDoor[] = [];
  for (const id of deletedDrawings) {
    if (id in prevDoors) {
      const doors = prevDoors[id];
      deletedDoors.push(...doors);
    }
    delete prevDoors[id];
  }

  const addedDoors: VisualDoor[] = [];
  for (const drawing of addedDrawings) {
    const doors = drawingToDoors(drawing, CanvasKit);
    addedDoors.push(...doors);
    prevDoors[drawing.id] = doors;
  }

  const updatedDoors: VisualDoor[] = [];
  const doorUpdates: Door[] = [];
  for (const drawing of updatedDrawings) {
    if (drawing.id in prevDoors) {
      const doors = prevDoors[drawing.id];
      const nextDoors = getMetadata<Door[]>(
        drawing.metadata,
        getPluginId("doors"),
        []
      );
      if (doors.length < nextDoors.length) {
        // Need to add more doors as there are new ones
        for (let i = doors.length - 1; i < nextDoors.length; i++) {
          const door = nextDoors[i];
          const visual = doorToVisual(drawing, CanvasKit, door);
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
      }

      // Update remaining doors
      for (let i = 0; i < doors.length; i++) {
        const door = doors[i];
        const nextDoor = nextDoors[i];
        updatedDoors.push(door);
        doorUpdates.push(nextDoor);
        door.base = nextDoor;
      }
    }
  }

  return [addedDoors, deletedDoors, updatedDoors, doorUpdates];
}

export function resetDoors() {
  prevDoors = {};
}

export function getDoorPaths() {
  return Object.values(prevDoors)
    .flat()
    .map((visual) => visual.skPath);
}

function drawingToDoors(drawing: Drawing, CanvasKit: CanvasKit): VisualDoor[] {
  const visuals: VisualDoor[] = [];
  const doors = getMetadata<Door[]>(drawing.metadata, getPluginId("doors"), []);
  for (const door of doors) {
    const visual = doorToVisual(drawing, CanvasKit, door);
    if (!visual) {
      continue;
    }
    visuals.push(visual);
  }
  return visuals;
}

export function doorToVisual(
  drawing: Drawing,
  CanvasKit: CanvasKit,
  door: Door
): VisualDoor | null {
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
    cap: isShape(drawing)
      ? CanvasKit.StrokeCap.Square
      : CanvasKit.StrokeCap.Round,
    join: isShape(drawing)
      ? CanvasKit.StrokeJoin.Miter
      : CanvasKit.StrokeJoin.Round,
    // TODO: Use grid stroke width instead
    // TODO: Check with zero width
    // Add a buffer to account for the segmentation of curves
    width: drawing.style.strokeWidth + 0.25,
  });
  return {
    base: door,
    skPath: segment,
    parent: drawing.id,
  };
}
