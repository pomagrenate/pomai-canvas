import { describe, expect, it } from "vitest";
import { calculateWasmElbowArrowPath } from "../src/elbowArrowWasm";

describe("elbowArrowWasm", () => {
  it("should calculate orthogonal path points between start and end points", () => {
    const points = calculateWasmElbowArrowPath(0, 0, 100, 100);

    expect(points.length).toBe(4);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[3]).toEqual({ x: 100, y: 100 });
  });
});
