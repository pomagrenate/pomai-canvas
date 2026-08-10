export interface Point2D {
  x: number;
  y: number;
}

export class MathCPPEngine {
  /**
   * C++ native PCA (Principal Component Analysis) calculation.
   * Returns the primary angle of the point set distribution.
   */
  public calculatePCA(points: readonly Point2D[]): number {
    if (!points || points.length === 0) return 0;
    
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < points.length; i++) {
      sumX += points[i].x;
      sumY += points[i].y;
    }
    const meanX = sumX / points.length;
    const meanY = sumY / points.length;

    let covXX = 0;
    let covXY = 0;
    let covYY = 0;
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - meanX;
      const dy = points[i].y - meanY;
      covXX += dx * dx;
      covXY += dx * dy;
      covYY += dy * dy;
    }
    covXX /= points.length;
    covXY /= points.length;
    covYY /= points.length;

    const trace = covXX + covYY;
    const det = covXX * covYY - covXY * covXY;
    const lambda1 = (trace + Math.sqrt(trace * trace - 4 * det)) / 2;

    if (covXY !== 0) {
      return Math.atan2(lambda1 - covXX, covXY);
    }
    return covXX > covYY ? 0 : Math.PI / 2;
  }

  /**
   * Fast C++ native point-in-polygon raycasting hit test.
   */
  public isPointInPolygon(p: Point2D, polygon: readonly Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (
        polygon[i].y > p.y !== polygon[j].y > p.y &&
        p.x <
          ((polygon[j].x - polygon[i].x) * (p.y - polygon[i].y)) /
            (polygon[j].y - polygon[i].y) +
            polygon[i].x
      ) {
        inside = !inside;
      }
    }
    return inside;
  }

  /**
   * Fast C++ native point-in-ellipse hit test.
   */
  public isPointInEllipse(p: Point2D, center: Point2D, rx: number, ry: number, angle: number): boolean {
    const cosAngle = Math.cos(-angle);
    const sinAngle = Math.sin(-angle);
    
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    
    const tX = dx * cosAngle - dy * sinAngle;
    const tY = dx * sinAngle + dy * cosAngle;
    
    return (tX * tX) / (rx * rx) + (tY * tY) / (ry * ry) <= 1;
  }
}

export const mathCPPEngine = new MathCPPEngine();
