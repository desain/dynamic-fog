import { Reactor } from "../Reactor";
import { Reconciler } from "../Reconciler";
import { Item } from "@owlbear-rodeo/sdk";
import { isDrawing } from "../../../types/Drawing";
import { DoorOverlayActor } from "../actors/DoorOverlayActor";

export class DoorOverlayReactor extends Reactor {
  constructor(reconciler: Reconciler) {
    super(reconciler, DoorOverlayActor);
  }

  filter(item: Item): boolean {
    return item.layer === "FOG" && isDrawing(item);
  }
}
