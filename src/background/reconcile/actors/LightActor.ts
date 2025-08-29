import {
  buildEffect,
  buildLight,
  buildPath,
  isEffect,
  isLight,
  isPath,
  Item,
  Light,
  Math2,
  type Effect,
  type Path,
  type Vector2,
} from "@owlbear-rodeo/sdk";
import type { Vector3 } from "@owlbear-rodeo/sdk/lib/types/Vector3";
import {
  breakIntersections,
  computeViewport,
  convertToSegments,
} from "visibility-polygon";
import { LightConfig } from "../../../types/LightConfig";
import { getMetadata } from "../../../util/getMetadata";
import { getPluginId } from "../../../util/getPluginId";
import { CardinalSpline } from "../../util/CardinalSpline";
import { PathHelpers } from "../../util/PathHelpers";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";
import { LightReactor } from "../reactors/LightReactor";

const COLOR_UNIFORM = "color";
const RADIUS_UNIFORM = "radius";

function parseColor(color: string) {
  return /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
}

function hexToRgb(hex: string): Vector3 | null {
  const result = parseColor(hex);
  return result?.[1] && result[2] && result[3]
    ? {
        x: parseInt(result[1], 16) / 255,
        y: parseInt(result[2], 16) / 255,
        z: parseInt(result[3], 16) / 255,
      }
    : null;
}

export class LightActor extends Actor {
  // ID of the current light item
  private light: string;
  // ID of the current polygon item
  private polygon: string;
  // ID of the current effect item
  private effect: string;

  //   private cachedWalls:
  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    const [light, polygon, effect] = this.parentToLocalItems(parent);
    this.light = light.id;
    this.polygon = polygon.id;
    this.effect = effect.id;
    this.reconciler.patcher.addItems(light, polygon, effect);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.light, this.polygon, this.effect);
  }

  update(parent: Item) {
    const config = getMetadata<LightConfig>(
      parent.metadata,
      getPluginId("light"),
      {}
    );
    this.reconciler.patcher.updateItems(
      [
        this.light,
        (item) => {
          if (isLight(item)) {
            this.applyLightConfig(parent, item, config);
          }
        },
      ],
      [
        this.polygon,
        (item) => {
          if (isPath(item)) {
            this.applyWalls(parent, item, config);
          }
        },
      ],
      [
        this.effect,
        (item) => {
          if (isEffect(item)) {
            this.applyEffect(item, config);
          }
        },
      ]
    );
  }

  private parentToLocalItems(parent: Item) {
    const config = getMetadata<LightConfig>(
      parent.metadata,
      getPluginId("light"),
      {}
    );
    const light = buildLight()
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .visible(parent.visible)
      .disableAttachmentBehavior(["SCALE", "COPY"])
      .build();

    const radius = config.attenuationRadius ?? 150;
    const path = buildPath()
      .attachedTo(parent.id)
      .position(parent.position)
      .strokeOpacity(0)
      .fillOpacity(0)
      .locked(true)
      .disableHit(true)
      .disableAttachmentBehavior([
        "SCALE",
        "COPY",
        "ROTATION",
        "LOCKED",
        "LOCKED",
      ])
      .build();

    const effect = buildEffect()
      .attachedTo(path.id)
      .disableHit(true)
      .effectType("ATTACHMENT")
      .uniforms([
        {
          name: RADIUS_UNIFORM,
          value: radius,
        },
        {
          name: COLOR_UNIFORM,
          value: (config.color ? hexToRgb(config.color) : null) ?? {
            x: 0,
            y: 0,
            z: 0,
          },
        },
      ])
      .sksl(
        `
        // https://thebookofshaders.com/05/
        // x from 0 to 1, a in the first quadrant unit square
        // if x > 1, can return NaN
        // output 0 to 1
        float quadraticBezier (float x, vec2 a){
            // adapted from BEZMATH.PS (1993)
            // by Don Lancaster, SYNERGETICS Inc.
            // http://www.tinaja.com/text/bezmath.html

            float epsilon = 0.00001;
            a.x = clamp(a.x,0.0,1.0);
            a.y = clamp(a.y,0.0,1.0);
            if (a.x == 0.5){
                a += epsilon;
            }

            // solve t from x (an inverse operation)
            float om2a = 1.0 - 2.0 * a.x;
            float t = (sqrt(a.x*a.x + om2a*x) - a.x)/om2a;
            float y = (1.0-2.0*a.y)*(t*t) + (2.0*a.y)*t;
            return y;
        }

        uniform vec3 ${COLOR_UNIFORM};
        uniform float ${RADIUS_UNIFORM};

        vec4 main(in float2 coord) {
            float pct = min(1.0, length(coord) / ${RADIUS_UNIFORM});
            float o = 0.5 - pct/2.0;
            vec3 c = mix(vec3(1.0), ${COLOR_UNIFORM}, quadraticBezier(pct, vec2(0.2, 0.7)));
            return vec4(c, 1.0) * o;
        }`
      )
      .blendMode("HARD_LIGHT")
      .layer("DRAWING")
      .build();

    this.applyLightConfig(parent, light, config);
    this.applyWalls(parent, path, config);
    this.applyEffect(effect, config);

    return [light, path, effect] as const;
  }

  private applyLightConfig(parent: Item, light: Light, config: LightConfig) {
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
    if (config.rotation !== undefined) {
      light.rotation = parent.rotation + config.rotation;
    }

    return light;
  }

  private applyWalls(parent: Item, path: Path, config: LightConfig) {
    if (!config.color || config.color === "#000000") {
      return;
    }
    const walls = this.reconciler.find(LightReactor)?.walls ?? [];
    // Update visibility polygon
    const segments = breakIntersections(convertToSegments(walls));
    const radius = config.attenuationRadius ?? 150;
    const viewportVisibility = computeViewport(
      [parent.position.x, parent.position.y],
      segments,
      [parent.position.x - radius, parent.position.y - radius],
      [parent.position.x + radius, parent.position.y + radius]
    );

    const visibilityPath = new this.reconciler.CanvasKit.Path();
    CardinalSpline.addToSkPath(
      visibilityPath,
      viewportVisibility.map(([x, y]) => ({
        x: x - parent.position.x,
        y: y - parent.position.y,
      })),
      0,
      true
    );

    if (config.outerAngle && config.outerAngle !== 360) {
      const viewportClippingPath = new this.reconciler.CanvasKit.Path();
      const angle = ((config.outerAngle ?? 360) * Math.PI) / 360;
      const rotation = (config.rotation ?? 0) + parent.rotation;
      const clipPoints: Vector2[] = [{ x: 0, y: 0 }];
      const clipPointsCount = 10;
      for (let i = 0; i <= clipPointsCount; i++) {
        const pointAngle = ((2 * i) / clipPointsCount - 1) * angle;
        clipPoints.push({
          x: Math.sin(pointAngle) * radius * 1.5,
          y: -Math.cos(pointAngle) * radius * 1.5,
        });
      }

      CardinalSpline.addToSkPath(
        viewportClippingPath,
        clipPoints.map((p) => Math2.rotate(p, { x: 0, y: 0 }, rotation)),
        0,
        true
      );
      visibilityPath.op(
        viewportClippingPath,
        this.reconciler.CanvasKit.PathOp.Intersect
      );
    }

    path.commands = PathHelpers.skPathToPathCommands(visibilityPath);
  }

  private applyEffect(effect: Effect, config: LightConfig) {
    const radius = config.attenuationRadius ?? 150;

    // Update color and radius
    const colorUniform = effect.uniforms.find(
      (uniform) => uniform.name === COLOR_UNIFORM
    );
    if (colorUniform) {
      const rgb = config.color ? hexToRgb(config.color) : null;
      if (rgb) {
        colorUniform.value = rgb;
      }
    }

    const radiusUniform = effect.uniforms.find(
      (uniform) => uniform.name === RADIUS_UNIFORM
    );
    if (radiusUniform) {
      radiusUniform.value = radius;
    }
  }
}
