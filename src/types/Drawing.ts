import {
  Curve,
  isCurve,
  isLine,
  isPath,
  isShape,
  Item,
  Line,
  Path,
  Shape,
} from "@owlbear-rodeo/sdk";

export type Drawing = Shape | Path | Curve | Line;

export function isDrawing(item: Item): item is Drawing {
  return isShape(item) || isPath(item) || isCurve(item) || isLine(item);
}
