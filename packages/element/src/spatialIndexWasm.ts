export interface BoundingBoxQuery {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpatialElementEntry {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  typeId?: number;
}

export interface SnapQueryResult {
  snapped: boolean;
  snapX: number;
  snapY: number;
  distance: number;
  snappedElementId: string;
}

/**
 * Spatial Index Engine Bridge.
 * Maintains element bounding boxes in memory for fast spatial range and snap queries.
 */
export class SpatialIndexWasmBridge {
  private elements: SpatialElementEntry[] = [];

  public clear(): void {
    this.elements = [];
  }

  public insert(entry: SpatialElementEntry): void {
    this.elements.push(entry);
  }

  public queryBounds(query: BoundingBoxQuery): string[] {
    const results: string[] = [];
    for (let i = 0; i < this.elements.length; i++) {
      const elem = this.elements[i];
      if (
        !(
          elem.minX > query.maxX ||
          elem.maxX < query.minX ||
          elem.minY > query.maxY ||
          elem.maxY < query.minY
        )
      ) {
        results.push(elem.id);
      }
    }
    return results;
  }

  public queryPoint(x: number, y: number): string[] {
    const results: string[] = [];
    for (let i = 0; i < this.elements.length; i++) {
      const elem = this.elements[i];
      if (
        x >= elem.minX &&
        x <= elem.maxX &&
        y >= elem.minY &&
        y <= elem.maxY
      ) {
        results.push(elem.id);
      }
    }
    return results;
  }

  public querySnap(targetX: number, targetY: number, threshold = 8): SnapQueryResult {
    let bestDistance = threshold;
    let result: SnapQueryResult = {
      snapped: false,
      snapX: targetX,
      snapY: targetY,
      distance: threshold,
      snappedElementId: "",
    };

    for (let i = 0; i < this.elements.length; i++) {
      const elem = this.elements[i];
      const cx = (elem.minX + elem.maxX) / 2;
      const cy = (elem.minY + elem.maxY) / 2;

      const candidatesX = [elem.minX, cx, elem.maxX];
      const candidatesY = [elem.minY, cy, elem.maxY];

      for (const candX of candidatesX) {
        const d = Math.abs(targetX - candX);
        if (d < bestDistance) {
          bestDistance = d;
          result.snapped = true;
          result.snapX = candX;
          result.snappedElementId = elem.id;
        }
      }

      for (const candY of candidatesY) {
        const d = Math.abs(targetY - candY);
        if (d < bestDistance) {
          bestDistance = d;
          result.snapped = true;
          result.snapY = candY;
          result.snappedElementId = elem.id;
        }
      }
    }

    result.distance = bestDistance;
    return result;
  }
}

export const globalSpatialIndexBridge = new SpatialIndexWasmBridge();
