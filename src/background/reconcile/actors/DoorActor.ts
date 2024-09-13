import { Item, MathM } from "@owlbear-rodeo/sdk";
import { Path as SkPath } from "canvaskit-wasm";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";
import { getMetadata } from "../../util/getMetadata";
import { getPluginId } from "../../../util/getPluginId";
import { Door } from "../../../types/Door";
import { Drawing, isDrawing } from "../../../types/Drawing";
import { PathHelpers } from "../../util/PathHelpers";

export interface DoorComponent {
  base: Door;
  // Current stroked door in world space
  skPath: SkPath;
}

export class DoorActor extends Actor {
  doors: DoorComponent[] = [];
  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    if (isDrawing(parent)) {
      this.doors = this.drawingToDoorComponents(parent);
    }
  }

  delete(): void {
    for (const door of this.doors) {
      door.skPath.delete();
    }
  }

  update(parent: Item) {
    if (!isDrawing(parent)) {
      return;
    }
    const prev = this.doors;
    const next = getMetadata<Door[]>(parent.metadata, getPluginId("doors"), []);
    if (prev.length < next.length) {
      // Need to add more doors as there are new ones
      for (let i = prev.length; i < next.length; i++) {
        const door = next[i];
        const visual = this.doorToDoorComponent(parent, door);
        if (visual) {
          prev.push(visual);
        }
      }
    } else if (prev.length > next.length) {
      // Need to remove doors as there are less
      const numRemoved = prev.length - next.length;
      const toDelete = prev.splice(prev.length - numRemoved, numRemoved);
      // Delete door paths
      for (const visual of toDelete) {
        visual.skPath.delete();
      }
    }
    // Update remaining doors
    for (let i = 0; i < prev.length; i++) {
      const door = prev[i];
      const nextDoor = next[i];
      door.base = nextDoor;
      const nextSkPath = this.getDoorSkPath(parent, nextDoor);
      if (nextSkPath) {
        door.skPath.delete();
        door.skPath = nextSkPath;
      }
    }
  }

  private drawingToDoorComponents(drawing: Drawing): DoorComponent[] {
    const visuals: DoorComponent[] = [];
    const doors = getMetadata<Door[]>(
      drawing.metadata,
      getPluginId("doors"),
      []
    );
    for (const door of doors) {
      const visual = this.doorToDoorComponent(drawing, door);
      if (!visual) {
        continue;
      }
      visuals.push(visual);
    }
    return visuals;
  }

  private doorToDoorComponent(
    drawing: Drawing,
    door: Door
  ): DoorComponent | null {
    const skPath = this.getDoorSkPath(drawing, door);
    if (!skPath) {
      return null;
    }
    return {
      base: door,
      skPath: skPath,
    };
  }

  private getDoorSkPath(drawing: Drawing, door: Door) {
    const skPath = PathHelpers.drawingToSkPath(
      drawing,
      this.reconciler.CanvasKit
    );
    if (!skPath) {
      return null;
    }
    const segment = PathHelpers.getSkPathBetween(
      this.reconciler.CanvasKit,
      skPath,
      door.start,
      door.end
    );
    skPath.delete();
    if (!segment) {
      return null;
    }
    segment.stroke({
      // Add a buffer to account for the segmentation of curves
      width: drawing.style.strokeWidth + 1,
    });

    // Transform segment into world space
    const transform = MathM.fromItem(drawing);
    segment.transform(...transform);

    return segment;
  }
}
