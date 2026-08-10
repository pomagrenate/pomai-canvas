import { describe, expect, it } from "vitest";
import { SceneGraphWasmBridge } from "../src/sceneGraphWasm";

describe("SceneGraphWasmBridge", () => {
  it("should upsert elements and query element count", () => {
    const scene = new SceneGraphWasmBridge();
    scene.upsert({
      id: "rect1",
      type: "rectangle",
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
      opacity: 100,
      strokeColor: 0x000000ff,
      backgroundColor: 0xffffffff,
      version: 1,
    });

    expect(scene.getElementCount()).toBe(1);
  });

  it("should perform frustum viewport culling", () => {
    const scene = new SceneGraphWasmBridge();
    scene.upsert({
      id: "rect1",
      type: "rectangle",
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
      opacity: 100,
      strokeColor: 0x000000ff,
      backgroundColor: 0xffffffff,
      version: 1,
    });

    scene.upsert({
      id: "rect2",
      type: "rectangle",
      minX: 1000,
      minY: 1000,
      maxX: 1100,
      maxY: 1100,
      opacity: 100,
      strokeColor: 0x000000ff,
      backgroundColor: 0xffffffff,
      version: 1,
    });

    const visible = scene.getVisibleElements({ minX: -50, minY: -50, maxX: 200, maxY: 200 });
    expect(visible.length).toBe(1);
    expect(visible[0].id).toBe("rect1");
  });
});
