import { buildWall, isWall, Item, Vector2, Wall } from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";
import { Drawing, isDrawing } from "../../../types/Drawing";
import { WallHelpers } from "../../util/WallHelpers";
import { DoorReactor } from "../reactors/DoorReactor";

export class WallActor extends Actor {
  // IDs of the current wall items
  private walls: string[] = [];
  private door: DoorReactor;
  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    const door = reconciler.find(DoorReactor);
    if (!door) {
      throw Error("Unable to create WallReactor: DoorReactor must exist");
    }
    this.door = door;
    if (isDrawing(parent)) {
      const items = this.drawingToWalls(parent);
      this.walls = items.map((item) => item.id);
      this.reconciler.patcher.addItems(...items);
    }
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(...this.walls);
  }

  update(parent: Item) {
    if (!isDrawing(parent)) {
      return;
    }
    const prev = this.walls;
    const next = WallHelpers.drawingToPolylines(
      parent,
      this.reconciler.CanvasKit,
      this.door.getDoors()
    );
    if (prev.length < next.length) {
      // Need to add more walls as there are new contours
      for (let i = prev.length; i < next.length; i++) {
        const polyline = next[i];
        const wall = this.polylineToWall(parent, polyline);
        prev.push(wall.id);
        this.reconciler.patcher.addItems(wall);
      }
    } else if (prev.length > next.length) {
      // Need to remove walls as there are less contours
      const numRemoved = prev.length - next.length;
      const toDelete = prev.splice(prev.length - numRemoved, numRemoved);
      this.reconciler.patcher.deleteItems(...toDelete.map((wall) => wall));
    }
    // Update remaining walls
    for (let i = 0; i < prev.length; i++) {
      const wall = prev[i];
      const polyline = next[i];
      this.reconciler.patcher.updateItems([
        wall,
        (item) => {
          if (isWall(item)) {
            item.points = polyline;
          }
        },
      ]);
    }
  }

  private drawingToWalls(drawing: Drawing): Wall[] {
    const doors = this.door.getDoors();
    const walls: Wall[] = [];
    const polylines = WallHelpers.drawingToPolylines(
      drawing,
      this.reconciler.CanvasKit,
      doors
    );
    for (const polyline of polylines) {
      walls.push(this.polylineToWall(drawing, polyline));
    }
    return walls;
  }

  private polylineToWall(drawing: Drawing, polyline: Vector2[]): Wall {
    const wall = buildWall()
      .points(polyline)
      .attachedTo(drawing.id)
      .position(drawing.position)
      .rotation(drawing.rotation)
      .scale(drawing.scale)
      .disableAttachmentBehavior(["VISIBLE", "COPY"])
      .build();
    return wall;
  }
}
