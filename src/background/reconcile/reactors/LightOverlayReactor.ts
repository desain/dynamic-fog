import { Reactor } from "../Reactor";
import { getPluginId } from "../../../util/getPluginId";
import { Reconciler } from "../Reconciler";
import { Item } from "@owlbear-rodeo/sdk";
import { LightOverlayActor } from "../actors/LightOverlayActor";

export class LightOverlayReactor extends Reactor {
  constructor(reconciler: Reconciler) {
    super(reconciler, LightOverlayActor);
  }

  filter(item: Item): boolean {
    return getPluginId("light") in item.metadata;
  }
}
