import { Reactor } from "../Reactor";
import { getPluginId } from "../../../util/getPluginId";
import { LightActor } from "../actors/LightActor";
import { Reconciler } from "../Reconciler";
import { Item } from "@owlbear-rodeo/sdk";

export class LightReactor extends Reactor {
  constructor(reconciler: Reconciler) {
    super(reconciler, LightActor);
  }

  filter(item: Item): boolean {
    return getPluginId("light") in item.metadata;
  }
}
