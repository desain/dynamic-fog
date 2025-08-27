import { LightType } from "@owlbear-rodeo/sdk";

export interface LightConfig {
  attenuationRadius?: number;
  sourceRadius?: number;
  falloff?: number;
  innerAngle?: number;
  outerAngle?: number;
  lightType?: LightType;
  rotation?: number;
  color?: string;
  onlyVisibleToOwner?: boolean;
}
