import { Reactor } from "../Reactor";
import { Reconciler } from "../Reconciler";
import { Item } from "@owlbear-rodeo/sdk";
import { isDrawing } from "../../../types/Drawing";
import { DoorReactor } from "./DoorReactor";
import { WallActor } from "../actors/WallActor";

export class WallReactor extends Reactor {
  private door: DoorReactor;
  constructor(reconciler: Reconciler) {
    super(reconciler, WallActor);
    const door = reconciler.find(DoorReactor);
    if (!door) {
      throw Error("Unable to create WallReactor: DoorReactor must exist");
    }
    this.door = door;
  }

  filter(item: Item): boolean {
    return item.layer === "FOG" && isDrawing(item);
  }

  diff(a: Item, b: Item): boolean {
    const lastUpdateChanged = super.diff(a, b);
    // Update all walls if any door has changed as it easier and cheaper then trying
    // to find all intersections between doors and walls to see if a change has occurred
    return lastUpdateChanged || this.door.getDidUpdate();
  }
}
