import OBR, { buildLight, isLight, Item, Light } from "@owlbear-rodeo/sdk";
import { getMetadata } from "../util/getMetadata";
import { getPluginId } from "../../util/getPluginId";
import { LightConfig } from "../../types/LightConfig";

let prevLights: Record<string, Light> = {};

export async function processLights(
  addedLightParents: Item[],
  deletedLightParents: Set<string>,
  updatedLightParents: Item[]
) {
  const deletedLights: string[] = [];
  for (const id of deletedLightParents) {
    if (id in prevLights) {
      const light = prevLights[id];
      deletedLights.push(light.id);
    }

    delete prevLights[id];
  }

  const addedLights: Light[] = [];
  for (const parent of addedLightParents) {
    const light = parentToLight(parent);
    addedLights.push(light);
    prevLights[parent.id] = light;
  }

  const updatedLights: Light[] = [];
  const lightUpdates: LightConfig[] = [];
  for (const parent of updatedLightParents) {
    if (!(parent.id in prevLights)) {
      continue;
    }
    const light = prevLights[parent.id];
    const config = getMetadata<LightConfig>(
      parent.metadata,
      getPluginId("light"),
      {}
    );
    updatedLights.push(light);
    lightUpdates.push(config);
    prevLights[parent.id] = applyLightConfig({ ...light }, config);
  }

  if (deletedLights.length > 0) {
    await OBR.scene.local.deleteItems(deletedLights);
  }
  if (addedLights.length > 0) {
    await OBR.scene.local.addItems(addedLights);
  }
  if (updatedLights.length > 0) {
    await OBR.scene.local.updateItems(updatedLights, (lights) => {
      for (let i = 0; i < lights.length; i++) {
        const config = lightUpdates[i];
        const light = lights[i];
        if (light && config && isLight(light)) {
          applyLightConfig(light, config);
        }
      }
    });
  }
}

export function resetLights() {
  prevLights = {};
}

function parentToLight(parent: Item) {
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

  applyLightConfig(light, config);

  return light;
}

function applyLightConfig(light: Light, config: LightConfig) {
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
  if (config.lightType !== undefined && config.lightType !== light.lightType) {
    light.lightType = config.lightType;
  }
  return light;
}
