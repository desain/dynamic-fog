import { buildWall, Vector2, Wall } from "@owlbear-rodeo/sdk";
import { Drawing } from "../drawing";
import { CanvasKit, Path as SkPath } from "canvaskit-wasm";
import { WallHelpers } from "../util/WallHelpers";

let prevWalls: Record<string, Wall[]> = {};

export function processWalls(
  addedDrawings: Drawing[],
  deletedDrawings: Set<string>,
  updatedDrawings: Drawing[],
  doors: SkPath[],
  CanvasKit: CanvasKit
): [Wall[], string[], Wall[], Vector2[][]] {
  const deletedWalls: string[] = [];
  for (const id of deletedDrawings) {
    if (id in prevWalls) {
      const walls = prevWalls[id];
      deletedWalls.push(...walls.map((wall) => wall.id));
    }

    delete prevWalls[id];
  }

  const addedWalls: Wall[] = [];
  for (const drawing of addedDrawings) {
    const walls = drawingToWalls(drawing, CanvasKit, doors);
    addedWalls.push(...walls);
    prevWalls[drawing.id] = walls;
  }

  const updatedWalls: Wall[] = [];
  const wallUpdates: Vector2[][] = [];
  for (const drawing of updatedDrawings) {
    if (drawing.id in prevWalls) {
      const walls = prevWalls[drawing.id];
      const contours = WallHelpers.drawingToContours(drawing, CanvasKit, doors);
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
        wall.points = contour;
      }
    }
  }

  return [addedWalls, deletedWalls, updatedWalls, wallUpdates];
}

export function resetWalls() {
  prevWalls = {};
}

function drawingToWalls(
  drawing: Drawing,
  CanvasKit: CanvasKit,
  doors: SkPath[]
): Wall[] {
  const walls: Wall[] = [];
  const contours = WallHelpers.drawingToContours(drawing, CanvasKit, doors);
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
