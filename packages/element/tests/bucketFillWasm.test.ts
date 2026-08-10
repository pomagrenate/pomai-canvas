import { describe, expect, it } from "vitest";
import { executeWasmFloodFill } from "../src/bucketFillWasm";

describe("executeWasmFloodFill", () => {
  it("should successfully flood fill a 10x10 pixel region", () => {
    const width = 10;
    const height = 10;
    const pixels = new Uint8ClampedArray(width * height * 4);

    // Initialize buffer with transparent / zero color (0x00000000)
    pixels.fill(0);

    const result = executeWasmFloodFill({
      pixels,
      width,
      height,
      startX: 5,
      startY: 5,
      fillColor: 0xff0000ff, // Red
      targetColor: 0x00000000,
      tolerance: 0,
    });

    expect(result.ok).toBe(true);
    expect(result.filledPixelCount).toBe(100);
  });

  it("should fail gracefully on out-of-bounds coordinates", () => {
    const width = 10;
    const height = 10;
    const pixels = new Uint8ClampedArray(width * height * 4);

    const result = executeWasmFloodFill({
      pixels,
      width,
      height,
      startX: -1,
      startY: 5,
      fillColor: 0xff0000ff,
      targetColor: 0x00000000,
      tolerance: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.filledPixelCount).toBe(0);
  });
});
