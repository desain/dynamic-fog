import { MathM, Matrix, Vector2 } from "@owlbear-rodeo/sdk";

export function transformPoint(matrix: Matrix, point: Vector2): Vector2 {
  const p = MathM.fromPosition(point);
  return MathM.decompose(MathM.multiply(matrix, p)).position;
}

export function inverseTransformPoint(matrix: Matrix, point: Vector2): Vector2 {
  const p = MathM.fromPosition(point);
  const inverse = MathM.inverse(matrix);
  return MathM.decompose(MathM.multiply(inverse, p)).position;
}
