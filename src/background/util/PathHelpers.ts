import { CanvasKit, Path as SkPath } from "canvaskit-wasm";
import { RegularPolygon } from "./RegularPolygon";
import { CardinalSpline } from "./CardinalSpline";
import {
  Command,
  Math2,
  PathCommand,
  Shape,
  Vector2,
  Curve,
  Line,
  Path,
  isShape,
  isCurve,
  isPath,
  isLine,
} from "@owlbear-rodeo/sdk";
import { Drawing } from "../../types/Drawing";

export interface ContourMarker {
  /** The distance on the contour */
  distance: number;
  /** The index of the contour  */
  index: number;
}

export interface PathIntersection {
  /** The point of intersection */
  point: Vector2;
  /** Distance to the point */
  distance: number;
  contour: ContourMarker;
}

export class PathHelpers {
  /**
   * Convert a CanvasKit SkPath into an OBR PathCommand array
   */
  static skPathToPathCommands(skPath: SkPath): PathCommand[] {
    const out: PathCommand[] = [];
    const cmds = skPath.toCmds();

    let current: PathCommand | null = null;
    for (const c of cmds) {
      if (!current) {
        current = [c];
      } else {
        current.push(c);
      }

      const maxLen = PathHelpers.getCommandLength(current[0]);
      if (current.length >= maxLen) {
        out.push(current);
        current = null;
      }
    }

    return out;
  }

  /**
   * Get how long the PathCommand is for a given Command verb
   */
  static getCommandLength(command: Command) {
    if (command === Command.CLOSE) {
      return 1;
    } else if (command === Command.MOVE) {
      return 3;
    } else if (command === Command.LINE) {
      return 3;
    } else if (command === Command.QUAD) {
      return 5;
    } else if (command === Command.CUBIC) {
      return 7;
    } else if (command === Command.CONIC) {
      return 6;
    }
    return 0;
  }

  /** Get the (x, y) point of an anchor from a path command */
  static getCommandPoint(command: PathCommand): Vector2 {
    const verb = command[0];
    switch (verb) {
      case Command.MOVE:
      case Command.LINE:
        return { x: command[1], y: command[2] };
      case Command.QUAD:
      case Command.CONIC:
        return { x: command[3], y: command[4] };
      case Command.CUBIC:
        return { x: command[5], y: command[6] };
      default:
        return { x: 0, y: 0 };
    }
  }

  /**
   * Sample a set of path commands by a fixed distance turning curves into a
   * fixed set of points
   */
  static samplePathCommands(
    CanvasKit: CanvasKit,
    commands: PathCommand[],
    distance: number
  ): Vector2[] {
    const skPath = CanvasKit.Path.MakeFromCmds(commands.flat());
    if (!skPath) {
      return [];
    }
    const points: Vector2[] = [];
    const iter = new CanvasKit.ContourMeasureIter(skPath, false, 1);
    let measure = iter.next();
    while (measure !== null) {
      const pathLength = measure.length();
      const numSamples = Math.ceil(pathLength / distance);
      for (let sample = 0; sample < numSamples; sample++) {
        const sampleDistance = Math.min(sample * distance, pathLength);
        const [x, y] = measure.getPosTan(sampleDistance);
        points.push({ x, y });
      }

      measure = iter.next();
    }
    skPath.delete();
    return points;
  }

  static getSkPathIntersection(
    CanvasKit: CanvasKit,
    skPath: SkPath,
    point: Vector2
  ): PathIntersection {
    const iter = new CanvasKit.ContourMeasureIter(skPath, false, 1);
    let measure = iter.next();
    let bestDistance = Infinity;
    let best: Float32Array = new Float32Array([0, 0, 0, 0]);
    let bestLength = 0;
    let bestContour = 0;

    let i = 0;
    while (measure !== null) {
      const pathLength = measure.length();
      let precision = 8;
      let bestContourLength = 0;
      let isClose = false;

      // Perform a coarse search for a closer point
      for (
        let scanLength = 0;
        scanLength <= pathLength;
        scanLength += precision
      ) {
        const scan = measure.getPosTan(scanLength);
        const scanDistance = Math2.distance({ x: scan[0], y: scan[1] }, point);
        if (scanDistance < bestDistance) {
          best = scan;
          bestContourLength = scanLength;
          bestDistance = scanDistance;
          bestLength = scanLength;
          bestContour = i;
          isClose = true;
        }
      }

      // If any of the coarse points are the closest refine it using binary search
      if (isClose) {
        precision /= 2;
        while (precision > 0.5) {
          const beforeLength = bestContourLength - precision;
          const afterLength = bestContourLength + precision;
          const before = measure.getPosTan(beforeLength);
          const after = measure.getPosTan(afterLength);
          const beforeDistance = Math2.distance(
            { x: before[0], y: before[1] },
            point
          );
          const afterDistance = Math2.distance(
            { x: after[0], y: after[1] },
            point
          );
          if (beforeLength >= 0 && beforeDistance < bestDistance) {
            best = before;
            bestContourLength = beforeLength;
            bestDistance = beforeDistance;
            bestLength = beforeLength;
            bestContour = i;
          } else if (
            afterLength <= pathLength &&
            afterDistance < bestDistance
          ) {
            best = after;
            bestContourLength = afterLength;
            bestDistance = afterDistance;
            bestLength = afterLength;
            bestContour = i;
          } else {
            precision /= 2;
          }
        }
      }

      i++;
      measure = iter.next();
    }

    iter.delete();

    return {
      point: { x: best[0], y: best[1] },
      distance: bestDistance,
      contour: {
        distance: bestLength,
        index: bestContour,
      },
    };
  }

  static getSkPathBetween(
    CanvasKit: CanvasKit,
    skPath: SkPath,
    start: ContourMarker,
    end: ContourMarker
  ): SkPath | null {
    if (start.index !== end.index) {
      console.warn("Unable to update subpath across contours");
      return null;
    }
    const iter = new CanvasKit.ContourMeasureIter(skPath, false, 1);
    let measure = iter.next();
    let i = 0;
    while (measure !== null) {
      // Find the correct contour
      if (i !== start.index) {
        measure = iter.next();
        i++;
      } else {
        const segment = measure.getSegment(
          Math.min(start.distance, end.distance),
          Math.max(start.distance, end.distance),
          true
        );

        return segment;
      }
    }
    return null;
  }

  static getCommandsBetween(
    CanvasKit: CanvasKit,
    skPath: SkPath,
    start: ContourMarker,
    end: ContourMarker
  ): PathCommand[] | null {
    const segment = PathHelpers.getSkPathBetween(CanvasKit, skPath, start, end);
    if (!segment) {
      return null;
    }
    const commands = PathHelpers.skPathToPathCommands(segment);
    segment.delete();
    return commands;
  }

  /**
   * Convert an OBR Shape into a CanvasKit SkPath
   */
  static shapeToSkPath(CanvasKit: CanvasKit, shape: Shape, out?: SkPath) {
    const skPath = out ?? new CanvasKit.Path();
    if (shape.shapeType === "RECTANGLE") {
      skPath.addRect(CanvasKit.XYWHRect(0, 0, shape.width, shape.height));
    } else if (shape.shapeType === "CIRCLE") {
      skPath.addOval(
        CanvasKit.XYWHRect(
          -shape.width / 2,
          -shape.height / 2,
          shape.width,
          shape.height
        )
      );
    } else if (shape.shapeType === "TRIANGLE") {
      skPath.moveTo(0, 0);
      skPath.lineTo(shape.width / 2, shape.height);
      skPath.lineTo(-shape.width / 2, shape.height);
      skPath.close();
    } else if (shape.shapeType === "HEXAGON") {
      const radius = Math.min(shape.width, shape.height) / 2;
      RegularPolygon.addToSkPath(skPath, radius, 6);
    } else {
      throw Error("Unable to get path for shape: path type not implemented");
    }
    return skPath;
  }

  /**
   * Convert an OBR Path into a CanvasKit SkPath
   */
  static pathToSkPath(CanvasKit: CanvasKit, path: Path) {
    const skPath = CanvasKit.Path.MakeFromCmds(path.commands.flat());
    const fillType =
      path.fillRule === "nonzero"
        ? CanvasKit.FillType.Winding
        : CanvasKit.FillType.EvenOdd;
    skPath?.setFillType(fillType);
    return skPath;
  }

  /**
   * Convert an OBR Curve into a CanvasKit SkPath
   */
  static curveToSkPath(CanvasKit: CanvasKit, curveData: Curve, out?: SkPath) {
    const skPath = out ?? new CanvasKit.Path();

    const tension = curveData.style.tension;
    const closed =
      curveData.style.fillOpacity > 0 || Boolean(curveData.style.closed);
    CardinalSpline.addToSkPath(skPath, curveData.points, tension, closed);

    return skPath;
  }

  /**
   * Convert an OBR Line into a CanvasKit SkPath
   */
  static lineToSkPath(CanvasKit: CanvasKit, line: Line, out?: SkPath) {
    const path = out ?? new CanvasKit.Path();

    path.moveTo(line.startPosition.x, line.startPosition.y);
    path.lineTo(line.endPosition.x, line.endPosition.y);

    return path;
  }

  /**
   * Convert any OBR drawing into a CanvasKit SkPath
   */
  static drawingToSkPath(
    drawing: Drawing,
    CanvasKit: CanvasKit
  ): SkPath | null {
    if (isShape(drawing)) {
      return PathHelpers.shapeToSkPath(CanvasKit, drawing);
    } else if (isCurve(drawing)) {
      return PathHelpers.curveToSkPath(CanvasKit, drawing);
    } else if (isPath(drawing)) {
      return PathHelpers.pathToSkPath(CanvasKit, drawing);
    } else if (isLine(drawing)) {
      return PathHelpers.lineToSkPath(CanvasKit, drawing);
    }

    return null;
  }
}
