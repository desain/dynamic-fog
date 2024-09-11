import { Item } from "@owlbear-rodeo/sdk";
import { Drawing, isDrawing } from "../../types/Drawing";
import { CanvasKit } from "canvaskit-wasm";
import { processWalls, resetWalls } from "./processWalls";
import { getDoorSkPaths, processDoors, resetDoors } from "./processDoors";
import { getPluginId } from "../../util/getPluginId";
import { processLights, resetLights } from "./processLights";

// A mapping of item IDs to the drawing item in the fog layer
let prevFogDrawings: Record<string, Drawing> = {};
// A mapping of item IDs to the item that has light metadata
let prevLightParents: Record<string, Item> = {};

export async function reconcile(items: Item[], CanvasKit: CanvasKit) {
  // Get update/changed/deleted fog drawings and items with light metadata
  const addedDrawings: Drawing[] = [];
  const deletedDrawings = new Set<string>([...Object.keys(prevFogDrawings)]);
  const existingDrawings: Drawing[] = [];
  let anyDrawingsUpdated = false;

  const addedLightParents: Item[] = [];
  const deletedLightParents = new Set<string>([
    ...Object.keys(prevLightParents),
  ]);
  const updatedLightParents: Item[] = [];

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

    if (getPluginId("light") in item.metadata) {
      if (item.id in prevLightParents) {
        const prev = prevLightParents[item.id];
        if (isItemOutdated(item, prev)) {
          updatedLightParents.push(item);
        }
      } else {
        addedLightParents.push(item);
      }
      deletedLightParents.delete(item.id);
      prevLightParents[item.id] = item;
    }
  }

  for (const id of deletedDrawings) {
    delete prevFogDrawings[id];
  }

  for (const id of deletedLightParents) {
    delete prevLightParents[id];
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
  await processLights(
    addedLightParents,
    deletedLightParents,
    updatedLightParents
  );
}

export function reset() {
  prevFogDrawings = {};
  resetWalls();
  resetDoors();
  resetLights();
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
