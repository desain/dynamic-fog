import { Item } from "@owlbear-rodeo/sdk";
import { Drawing, isDrawing } from "../drawing";
import { CanvasKit } from "canvaskit-wasm";
import { processWalls, resetWalls } from "./processWalls";
import { getDoorSkPaths, processDoors, resetDoors } from "./processDoors";

let prevFogDrawings: Record<string, Drawing> = {};

export async function reconcile(items: Item[], CanvasKit: CanvasKit) {
  const addedDrawings: Drawing[] = [];
  const deletedDrawings = new Set<string>([...Object.keys(prevFogDrawings)]);
  const existingDrawings: Drawing[] = [];

  let anyDrawingsUpdated = false;

  for (const item of items) {
    if (item.layer === "FOG" && isDrawing(item)) {
      if (item.id in prevFogDrawings) {
        const prev = prevFogDrawings[item.id];
        if (isItemOutdated(item, prev)) {
          anyDrawingsUpdated = true;
        }
        existingDrawings.push(item);
      } else {
        addedDrawings.push(item);
      }
      deletedDrawings.delete(item.id);
      prevFogDrawings[item.id] = item;
    }
  }

  for (const id of deletedDrawings) {
    delete prevFogDrawings[id];
  }

  // If any drawings have been updated then update all walls and doors
  // This is easier than checking the possible intersections between all walls and doors
  const updatedDrawings: Drawing[] = anyDrawingsUpdated ? existingDrawings : [];

  processDoors(addedDrawings, deletedDrawings, updatedDrawings, CanvasKit);
  await processWalls(
    addedDrawings,
    deletedDrawings,
    updatedDrawings,
    getDoorSkPaths(),
    CanvasKit
  );
}

export function reset() {
  prevFogDrawings = {};
  resetWalls();
  resetDoors();
}

export function getDrawing(id: string): Drawing | undefined {
  return prevFogDrawings[id];
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
