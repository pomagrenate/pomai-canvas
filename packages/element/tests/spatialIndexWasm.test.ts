import { describe, expect, it } from "vitest";
import { SpatialIndexWasmBridge } from "../src/spatialIndexWasm";

describe("SpatialIndexWasmBridge", () => {
  it("should query elements intersecting a bounding box", () => {
    const index = new SpatialIndexWasmBridge();
    index.insert({ id: "el1", minX: 0, minY: 0, maxX: 100, maxY: 100 });
    index.insert({ id: "el2", minX: 200, minY: 200, maxX: 300, maxY: 300 });

    const results = index.queryBounds({ minX: 50, minY: 50, maxX: 150, maxY: 150 });
    expect(results).toEqual(["el1"]);
  });

  it("should query elements containing a point", () => {
    const index = new SpatialIndexWasmBridge();
    index.insert({ id: "el1", minX: 10, minY: 10, maxX: 50, maxY: 50 });

    const results = index.queryPoint(25, 25);
    expect(results).toEqual(["el1"]);
  });

  it("should perform snap query to nearest element boundary/center", () => {
    const index = new SpatialIndexWasmBridge();
    index.insert({ id: "el1", minX: 100, minY: 100, maxX: 200, maxY: 200 });

    // 103 is 3px away from minX (100) -> should snap to 100
    const snapResult = index.querySnap(103, 50, 8);
    expect(snapResult.snapped).toBe(true);
    expect(snapResult.snapX).toBe(100);
    expect(snapResult.snappedElementId).toBe("el1");
  });
});
