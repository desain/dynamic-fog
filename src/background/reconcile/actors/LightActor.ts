import { buildLight, isLight, Item, Light } from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";
import { LightConfig } from "../../../types/LightConfig";
import { getMetadata } from "../../util/getMetadata";
import { getPluginId } from "../../../util/getPluginId";

export class LightActor extends Actor {
  private light: Light;
  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    this.light = this.parentToLight(parent);
    this.reconciler.patcher.addItems(this.light);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.light.id);
  }

  update(parent: Item) {
    const config = getMetadata<LightConfig>(
      parent.metadata,
      getPluginId("light"),
      {}
    );
    this.reconciler.patcher.updateItems([
      this.light.id,
      (item) => {
        if (isLight(item)) {
          this.applyLightConfig(item, config);
        }
      },
    ]);
  }

  private parentToLight(parent: Item) {
    const config = getMetadata<LightConfig>(
      parent.metadata,
      getPluginId("light"),
      {}
    );
    const light = buildLight()
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .disableAttachmentBehavior(["SCALE"])
      .build();

    this.applyLightConfig(light, config);

    return light;
  }

  private applyLightConfig(light: Light, config: LightConfig) {
    if (
      config.attenuationRadius !== undefined &&
      config.attenuationRadius !== light.attenuationRadius
    ) {
      light.attenuationRadius = config.attenuationRadius;
    }
    if (
      config.sourceRadius !== undefined &&
      config.sourceRadius !== light.sourceRadius
    ) {
      light.sourceRadius = config.sourceRadius;
    }
    if (config.falloff !== undefined && config.falloff !== light.falloff) {
      light.falloff = config.falloff;
    }
    if (
      config.innerAngle !== undefined &&
      config.innerAngle !== light.innerAngle
    ) {
      light.innerAngle = config.innerAngle;
    }
    if (
      config.outerAngle !== undefined &&
      config.outerAngle !== light.outerAngle
    ) {
      light.outerAngle = config.outerAngle;
    }
    if (
      config.lightType !== undefined &&
      config.lightType !== light.lightType
    ) {
      light.lightType = config.lightType;
    }
    return light;
  }
}
