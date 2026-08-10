export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export class CommonCPPEngine {
  public computeBounds(points: readonly Point2D[]): BoundingBox {
    if (!points || points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (let i = 1; i < points.length; i++) {
      const pt = points[i];
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  public transformPoints(
    points: readonly Point2D[],
    angle: number,
    cx: number,
    cy: number,
  ): Point2D[] {
    if (angle === 0 || !points || points.length === 0) {
      return points ? points.slice() : [];
    }

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const result: Point2D[] = new Array(points.length);

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      result[i] = {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    }

    return result;
  }

  public rgbToHsl(r: number, g: number, b: number): HSLColor {
    const rf = r / 255;
    const gf = g / 255;
    const bf = b / 255;

    const max = Math.max(rf, gf, bf);
    const min = Math.min(rf, gf, bf);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta > 0.00001) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === rf) {
        h = (gf - bf) / delta + (gf < bf ? 6 : 0);
      } else if (max === gf) {
        h = (bf - rf) / delta + 2;
      } else {
        h = (rf - gf) / delta + 4;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  public getContrastRatio(
    r1: number, g1: number, b1: number,
    r2: number, g2: number, b2: number,
  ): number {
    const getLuminance = (r: number, g: number, b: number) => {
      const transform = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
    };

    const l1 = getLuminance(r1, g1, b1);
    const l2 = getLuminance(r2, g2, b2);
    const maxL = Math.max(l1, l2);
    const minL = Math.min(l1, l2);

    return (maxL + 0.05) / (minL + 0.05);
  }
}

export const commonCPPEngine = new CommonCPPEngine();
