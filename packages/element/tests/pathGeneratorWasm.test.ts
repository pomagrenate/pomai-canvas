import { describe, expect, it } from "vitest";
import {
  generateBinaryJitteredLine,
  generateBinaryJitteredRectangle,
} from "../src/pathGeneratorWasm";

describe("pathGeneratorWasm", () => {
  it("should generate binary Float32 vertex buffer for line", () => {
    const line = generateBinaryJitteredLine(0, 0, 100, 0, 1.0, 42);

    expect(line.vertexCount).toBeGreaterThan(2);
    expect(line.flatVertices.length).toBe(line.vertexCount * 2);
    // Start vertex should be (0, 0)
    expect(line.flatVertices[0]).toBe(0);
    expect(line.flatVertices[1]).toBe(0);
  });

  it("should generate binary Float32 vertex buffer for rectangle", () => {
    const rect = generateBinaryJitteredRectangle(0, 0, 100, 100, 1.0, 42);

    expect(rect.vertexCount).toBeGreaterThan(8);
    expect(rect.flatVertices.length).toBe(rect.vertexCount * 2);
  });
});
