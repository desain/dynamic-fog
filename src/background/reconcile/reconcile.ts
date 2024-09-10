import OBR, { isWall, Item } from "@owlbear-rodeo/sdk";
import { Drawing, isDrawing } from "../drawing";
import { CanvasKit } from "canvaskit-wasm";
import { processWalls, resetWalls } from "./processWalls";
import {
  doorToVisual,
  getDoorPaths,
  processDoors,
  resetDoors,
} from "./processDoors";

let prevFogDrawings: Record<string, Drawing> = {};

export async function reconcile(items: Item[], CanvasKit: CanvasKit) {
  const addedDrawings: Drawing[] = [];
  const deletedDrawings = new Set<string>([...Object.keys(prevFogDrawings)]);
  const updatedDrawings: Drawing[] = [];

  for (const item of items) {
    if (item.layer === "FOG" && isDrawing(item)) {
      if (item.id in prevFogDrawings) {
        const prev = prevFogDrawings[item.id];
        if (isItemOutdated(item, prev)) {
          updatedDrawings.push(item);
        }
      } else {
        addedDrawings.push(item);
      }
      deletedDrawings.delete(item.id);
    }
  }

  const [, , updatedDoors, doorUpdates] = processDoors(
    addedDrawings,
    deletedDrawings,
    updatedDrawings,
    CanvasKit
  );

  for (let i = 0; i < updatedDoors.length; i++) {
    const nextBase = doorUpdates[i];
    const door = updatedDoors[i];
    const drawing = prevFogDrawings[door.parent];
    if (nextBase && door && drawing) {
      const nextVisual = doorToVisual(drawing, CanvasKit, nextBase);
      if (nextVisual) {
        door.skPath.delete();
        door.skPath = nextVisual.skPath;
      }
    }
  }

  const [addedWalls, deletedWalls, updatedWalls, wallUpdates] = processWalls(
    addedDrawings,
    deletedDrawings,
    updatedDrawings,
    getDoorPaths(),
    CanvasKit
  );

  for (const drawing of addedDrawings) {
    prevFogDrawings[drawing.id] = drawing;
  }

  for (const drawing of updatedDrawings) {
    prevFogDrawings[drawing.id] = drawing;
  }

  for (const id of deletedDrawings) {
    delete prevFogDrawings[id];
  }

  await OBR.scene.local.deleteItems(deletedWalls);
  await OBR.scene.local.addItems(addedWalls);
  await OBR.scene.local.updateItems(updatedWalls, (walls) => {
    for (let i = 0; i < walls.length; i++) {
      const points = wallUpdates[i];
      const wall = walls[i];
      if (wall && points && isWall(wall)) {
        wall.points = points;
      }
    }
  });
}

export function reset() {
  prevFogDrawings = {};
  resetWalls();
  resetDoors();
}

function isItemOutdated(a: Item, b: Item) {
  try {
    const aLastMod = new Date(a.lastModified).valueOf();
    const bLastMod = new Date(b.lastModified).valueOf();
    return aLastMod !== bLastMod;
  } catch {
    return false;
  }
}
