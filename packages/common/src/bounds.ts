/**
 * x and y position of top left corner, x and y position of bottom right corner
 */
export type Bounds = readonly [
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
];

export const isBounds = (box: unknown): box is Bounds =>
  Array.isArray(box) &&
  box.length === 4 &&
  typeof box[0] === "number" &&
  typeof box[1] === "number" &&
  typeof box[2] === "number" &&
  typeof box[3] === "number";

import { poRenderEngine, Point2D } from "./poRenderWasmBridge";

export const computeBoundsFromPointsWasm = (points: readonly Point2D[]): Bounds => {
  const box = poRenderEngine.computeBounds(points);
  return [box.minX, box.minY, box.maxX, box.maxY];
};

export const isPointInBoundsWasm = (
  px: number,
  py: number,
  bounds: Bounds,
): boolean => {
  return poRenderEngine.isPointInBounds(px, py, {
    minX: bounds[0],
    minY: bounds[1],
    maxX: bounds[2],
    maxY: bounds[3],
    width: bounds[2] - bounds[0],
    height: bounds[3] - bounds[1],
  });
};
