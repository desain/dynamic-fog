import {
  buildEffect,
  buildLight,
  buildPath,
  isEffect,
  isLight,
  isPath,
  Item,
  Light,
  type AttachmentBehavior,
  type Effect,
  type Path,
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
import type { LineString } from "../../util/WallHelpers";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";
import { LightReactor } from "../reactors/LightReactor";

const COLOR_UNIFORM = "color";
const RADIUS_UNIFORM = "radius";
const OUTER_ANGLE_UNIFORM = "outerAngle";
const ROTATION_UNIFORM = "configRotation";

function isPrimaryLight(config: LightConfig) {
  return config.lightType === undefined || config.lightType === "PRIMARY";
}

function getGlowSksl(walls: LineString[] | undefined) {
  const segments = walls?.flatMap((wall) =>
    wall
      .map((p, i) => {
        const q = wall[i + 1];
        return q ? ([p, q] as const) : null;
      })
      .filter((s) => s !== null)
  );

  const isect = segments
    ?.map(
      ([[px, py], [qx, qy]]) =>
        `if (isect(position,w,vec2(${Math.round(px)},${Math.round(
          py
        )}),vec2(${Math.round(qx)},${Math.round(qy)}))) {return vec4(0);}`
    )
    .join("\n");

  return `
    const float PI = 3.1415926535897932384626433832795;
    uniform vec2 position;
    uniform float rotation;

    uniform vec3 ${COLOR_UNIFORM};
    uniform float ${RADIUS_UNIFORM};
    uniform float ${OUTER_ANGLE_UNIFORM};
    uniform float ${ROTATION_UNIFORM};

    float quadraticBezier (float x, vec2 a){
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

    float cross2(vec2 a, vec2 b) { return a.x*b.y - a.y*b.x; }
    bool near(vec2 a, vec2 b, float eps) { return length(a - b) <= eps; }

    bool isect(vec2 p0, vec2 p1, vec2 q0, vec2 q1) {
        const float eps = 1e-6;

        vec2 r = p1 - p0;
        vec2 s = q1 - q0;
        float rxs = cross2(r, s);
        vec2 qp = q0 - p0;
        float qpxr = cross2(qp, r);

        // parallel
        if (abs(rxs) < eps) {
            // colinear
            if (abs(qpxr) < eps) {
                // unique endpoint touch?
                if (near(p0, q0, eps) || near(p0, q1, eps)) { /*P = p0*/; return true; }
                if (near(p1, q0, eps) || near(p1, q1, eps)) { /*P = p1*/; return true; }
                // overlapping but not a single point -> no unique intersection
                return false;
            }
            // parallel, disjoint
            return false;
        }

        float t = cross2(qp, s) / rxs;
        float u = cross2(qp, r) / rxs;

        if (t >= -eps && t <= 1.0 + eps && u >= -eps && u <= 1.0 + eps) {
            //P = p0 + t * r;
            return true;
        }
        return false;
    }
    
    mat2 rotate(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat2(
            c,  s,    // first column
            -s,  c   // second column
        );
    }

    float anglediff(float src, float dst) { return mod(dst - src + 3*PI, 2*PI) - PI; }

    vec4 main(in float2 coord) {
        float rotationRadians = rotation*PI/180.0;
        vec2 w = coord * rotate(-rotationRadians) + position;

        float angle = coord.y == 0 ? 0 : atan(-coord.x, -coord.y);
        if (abs(anglediff(angle, -${ROTATION_UNIFORM})) > ${OUTER_ANGLE_UNIFORM}) { return vec4(0); }

        ${isect ?? ""}

        float pct = min(1.0, length(coord) / ${RADIUS_UNIFORM});
        float o = 0.5 - pct/2.0;
        vec3 c = mix(vec3(1.0), ${COLOR_UNIFORM}, quadraticBezier(pct, vec2(0.2, 0.7)));
        return vec4(c, 1.0) * o;
    }`;
}

function getGlowPolygonDisableAttachmentBehavior(): AttachmentBehavior[] {
  return ["SCALE", "COPY", "LOCKED"];
}

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
            this.applyEffect(parent, item, config);
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
      .disableAttachmentBehavior(getGlowPolygonDisableAttachmentBehavior())
      .build();

    const effect = buildEffect()
      .attachedTo(path.id)
      .position(path.position)
      .locked(true)
      .disableHit(true)
      .disableAttachmentBehavior(["SCALE", "COPY"])
      .effectType("ATTACHMENT")
      .uniforms([
        { name: RADIUS_UNIFORM, value: radius },
        {
          name: COLOR_UNIFORM,
          value: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        { name: OUTER_ANGLE_UNIFORM, value: 0 },
        { name: ROTATION_UNIFORM, value: 0 },
      ])
      .blendMode("HARD_LIGHT")
      .layer("DRAWING")
      .build();

    this.applyLightConfig(parent, light, config);
    this.applyWalls(parent, path, config);
    this.applyEffect(parent, effect, config);

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

    const radius = config.attenuationRadius ?? 150;
    const visibilityPath = new this.reconciler.CanvasKit.Path();
    // Primary lights do collision in SKSL, so just do a square polygon
    if (isPrimaryLight(config)) {
      CardinalSpline.addToSkPath(
        visibilityPath,
        [
          { x: -radius, y: -radius },
          { x: radius, y: -radius },
          { x: radius, y: radius },
          { x: -radius, y: radius },
        ],
        0,
        true
      );
    } else {
      const walls = this.reconciler.find(LightReactor)?.walls ?? [];
      // Update visibility polygon
      const segments = breakIntersections(convertToSegments(walls));
      const viewportVisibility = computeViewport(
        [parent.position.x, parent.position.y],
        segments,
        [parent.position.x - radius, parent.position.y - radius],
        [parent.position.x + radius, parent.position.y + radius]
      );

      CardinalSpline.addToSkPath(
        visibilityPath,
        viewportVisibility.map(([x, y]) => ({
          x: x - parent.position.x,
          y: y - parent.position.y,
        })),
        0,
        true
      );
    }

    path.rotation = isPrimaryLight(config) ? parent.rotation : 0;
    path.commands = PathHelpers.skPathToPathCommands(visibilityPath);
  }

  private applyEffect(parent: Item, effect: Effect, config: LightConfig) {
    const radius = config.attenuationRadius ?? 150;

    const hardcodedWalls = isPrimaryLight(config)
      ? this.reconciler.find(LightReactor)?.walls
      : undefined;

    effect.sksl = getGlowSksl(hardcodedWalls);
    effect.rotation = isPrimaryLight(config) ? parent.rotation : 0;

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

    const outerAngleUniform = effect.uniforms.find(
      (uniform) => uniform.name === OUTER_ANGLE_UNIFORM
    );
    if (outerAngleUniform) {
      outerAngleUniform.value = config.outerAngle
        ? (Math.PI * config.outerAngle) / 360
        : Math.PI;
    }

    const rotationUniform = effect.uniforms.find(
      (uniform) => uniform.name === ROTATION_UNIFORM
    );
    if (rotationUniform) {
      rotationUniform.value = config.rotation
        ? (Math.PI * config.rotation) / 180
        : 0;
      if (config.lightType === "SECONDARY") {
        rotationUniform.value += (parent.rotation * Math.PI) / 180;
      }
    }
  }
}
