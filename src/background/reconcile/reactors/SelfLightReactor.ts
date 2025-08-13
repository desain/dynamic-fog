import { Reactor } from "../Reactor";
import { getPluginId } from "../../../util/getPluginId";
import { SelfLightActor } from "../actors/SelfLightActor";
import { Reconciler } from "../Reconciler";
import { Item } from "@owlbear-rodeo/sdk";
import { getMetadata } from "../../../util/getMetadata";
import { LightConfig } from "../../../types/LightConfig";

export class SelfLightReactor extends Reactor {
  constructor(reconciler: Reconciler) {
    super(reconciler, SelfLightActor);
  }

  filter(item: Item): boolean {
    if (!(getPluginId("light") in item.metadata)) {
      return false;
    }

    const config = getMetadata<LightConfig>(
      item.metadata,
      getPluginId("light"),
      {}
    );

    // Only show self light for primary lights that are angled
    return (
      config.outerAngle !== undefined &&
      config.outerAngle !== 360 &&
      (config.lightType === "PRIMARY" || config.lightType === undefined)
    );
  }
}
