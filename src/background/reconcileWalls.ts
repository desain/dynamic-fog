import OBR, {
  buildWall,
  isWall,
  Item,
  Vector2,
  Wall,
} from "@owlbear-rodeo/sdk";
import { Drawing, isDrawing } from "./drawing";
import { CanvasKit } from "canvaskit-wasm";
import { WallHelpers } from "./util/WallHelpers";

let prevFogDrawings: Record<string, Drawing> = {};
let prevWalls: Record<string, Wall[]> = {};

export async function reconcileWalls(items: Item[], CanvasKit: CanvasKit) {
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

  const deletedWalls: string[] = [];
  for (const id of deletedDrawings) {
    if (id in prevWalls) {
      const walls = prevWalls[id];
      deletedWalls.push(...walls.map((wall) => wall.id));
    }

    delete prevFogDrawings[id];
    delete prevWalls[id];
  }

  const addedWalls: Wall[] = [];
  for (const drawing of addedDrawings) {
    const walls = drawingToWalls(drawing, CanvasKit);
    addedWalls.push(...walls);
    prevFogDrawings[drawing.id] = drawing;
    prevWalls[drawing.id] = walls;
  }

  const updatedWalls: Wall[] = [];
  const wallUpdates: Vector2[][] = [];
  for (const drawing of updatedDrawings) {
    if (drawing.id in prevWalls) {
      const walls = prevWalls[drawing.id];
      const contours = WallHelpers.drawingToContours(drawing, CanvasKit);
      if (walls.length < contours.length) {
        // Need to add more walls as there are new contours
        for (let i = walls.length - 1; i < contours.length; i++) {
          const contour = contours[i];
          const wall = contourToWall(drawing, contour);
          walls.push(wall);
          addedWalls.push(wall);
        }
      } else if (walls.length > contours.length) {
        // Need to remove walls as there are less contours
        const numRemoved = walls.length - contours.length;
        const toDelete = walls.splice(walls.length - numRemoved, numRemoved);
        deletedWalls.push(...toDelete.map((wall) => wall.id));
      }

      // Update remaining walls
      for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        const contour = contours[i];
        updatedWalls.push(wall);
        wallUpdates.push(contour);
      }
    }
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

export function clearWalls() {
  prevFogDrawings = {};
  prevWalls = {};
}

function drawingToWalls(drawing: Drawing, CanvasKit: CanvasKit): Wall[] {
  const walls: Wall[] = [];
  const contours = WallHelpers.drawingToContours(drawing, CanvasKit);
  for (const contour of contours) {
    walls.push(contourToWall(drawing, contour));
  }
  return walls;
}

function contourToWall(drawing: Drawing, contour: Vector2[]): Wall {
  const wall = buildWall()
    .points(contour)
    .attachedTo(drawing.id)
    .position(drawing.position)
    .rotation(drawing.rotation)
    .scale(drawing.scale)
    .blocking(false)
    .build();
  return wall;
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
