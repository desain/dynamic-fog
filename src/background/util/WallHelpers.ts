import { isShape, MathM, Vector2 } from "@owlbear-rodeo/sdk";
import { CanvasKit } from "canvaskit-wasm";
import { Drawing } from "../../types/Drawing";
import { DoorComponent } from "../reconcile/actors/DoorActor";
import { PathHelpers } from "./PathHelpers";

type Position2 = [x: number, y: number];
export type LineString = Position2[];

export class WallHelpers {
  /**
   * Convert a drawing into an array of contours
   * Each contour is an array of points that represent a single continuous polyline.
   * You may have multiple contours if the input is a Path item with multiple inside shapes
   * For straight lines the points will be converted exactly to the output
   * For curved surfaces the curves will be sampled by `sampleDistance`
   */
  static drawingToPolylines(
    drawing: Drawing,
    CanvasKit: CanvasKit,
    doors: DoorComponent[],
    sampleDistance = 10
  ): Vector2[][] {
    const skPath = PathHelpers.drawingToSkPath(drawing, CanvasKit);
    skPath?.stroke({
      cap: isShape(drawing)
        ? CanvasKit.StrokeCap.Square
        : CanvasKit.StrokeCap.Round,
      join: isShape(drawing)
        ? CanvasKit.StrokeJoin.Miter
        : CanvasKit.StrokeJoin.Round,
      width: drawing.style.strokeWidth,
    });

    const commands = skPath && PathHelpers.skPathToPathCommands(skPath);
    skPath?.delete();

    if (!commands) {
      return [];
    }

    const lines = PathHelpers.commandsToPolylines(
      CanvasKit,
      commands,
      sampleDistance
    );

    // Apply door subtractions in world space
    // We apply them after polyline simplification because of
    // artifacts with subtractions and curves
    const skLines = new CanvasKit.Path();
    for (const polyline of lines) {
      skLines.addPoly(
        polyline.flatMap((p) => [p.x, p.y]),
        true
      );
    }
    const transform = MathM.fromItem(drawing);
    skLines.transform(...transform);
    for (const door of doors) {
      if (door.base.open) {
        skLines.op(door.skPath, CanvasKit.PathOp.Difference);
      }
    }
    skLines.transform(...MathM.inverse(transform));

    // Convert to final polylines with door subtraction
    const lineCommands = PathHelpers.skPathToPathCommands(skLines);
    return PathHelpers.commandsToPolylines(
      CanvasKit,
      lineCommands,
      sampleDistance
    );
  }
}
