/**
 * High-Performance Native C++/WASM Engine Bridge for packages/common.
 * Delegates geometric math, bounding box evaluation, and point matrix ops to C++ core.
 */

import { commonCPPEngine, Point2D, BoundingBox, HSLColor } from "./wasm/index";

export type { Point2D, BoundingBox, HSLColor };

export class PORenderWasmEngine {
  public computeBounds(points: readonly Point2D[]): BoundingBox {
    return commonCPPEngine.computeBounds(points);
  }

  public transformPoints(
    points: readonly Point2D[],
    angle: number,
    cx: number,
    cy: number,
  ): Point2D[] {
    return commonCPPEngine.transformPoints(points, angle, cx, cy);
  }

  public isPointInBounds(px: number, py: number, bounds: BoundingBox): boolean {
    return (
      px >= bounds.minX &&
      px <= bounds.maxX &&
      py >= bounds.minY &&
      py <= bounds.maxY
    );
  }

  public rgbToHsl(r: number, g: number, b: number): HSLColor {
    return commonCPPEngine.rgbToHsl(r, g, b);
  }

  public getContrastRatio(
    r1: number, g1: number, b1: number,
    r2: number, g2: number, b2: number,
  ): number {
    return commonCPPEngine.getContrastRatio(r1, g1, b1, r2, g2, b2);
  }
}

export const poRenderEngine = new PORenderWasmEngine();
