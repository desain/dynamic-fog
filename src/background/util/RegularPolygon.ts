import { Math2, Vector2 } from "@owlbear-rodeo/sdk";
import { Path as SkPath } from "canvaskit-wasm";

export class RegularPolygon {
  // Generate polygon points for n subdivisions
  static addToSkPath(skPath: SkPath, radius: number, subdivisions: number) {
    const points: Vector2[] = [];
    for (let division = 0; division < subdivisions; division++) {
      points.push(
        Math2.rotate(
          { x: 0, y: -radius },
          { x: 0, y: 0 },
          (360 / subdivisions) * division
        )
      );
    }
    if (points.length > 1) {
      skPath.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        skPath.lineTo(points[i].x, points[i].y);
      }
      skPath.close();
    }
  }
}
