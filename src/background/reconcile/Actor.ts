import { Item } from "@owlbear-rodeo/sdk";
import { Reconciler } from "./Reconciler";

/**
 * Will be attached to one item in the OBR shared scene. It also ties itself
 * to that lifecycle.
 * This can be used to keep a CanvasKit path for each item (like Doors) or
 * can also be used to create and manage an attachment in the local OBR scene
 * (like Lights)
 */
export abstract class Actor {
  protected reconciler: Reconciler;

  constructor(reconciler: Reconciler) {
    this.reconciler = reconciler;
  }

  abstract delete(): void;
  abstract update(parent: Item): void;
}
