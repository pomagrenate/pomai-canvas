import { describe, expect, it, vi } from "vitest";
import { PORenderBridge } from "../src/poRenderBridge";

describe("PORenderBridge", () => {
  it("should draw rectangle with stroke and fill using po_render API", () => {
    const bridge = new PORenderBridge();
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    bridge.drawRectangle(mockCtx, 10, 10, 100, 50, {
      strokeColor: "#000000",
      backgroundColor: "#ffffff",
      strokeWidth: 2,
      roughness: 1,
    });

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.fillRect).toHaveBeenCalledWith(10, 10, 100, 50);
    expect(mockCtx.strokeRect).toHaveBeenCalledWith(10, 10, 100, 50);
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it("should draw ellipse using po_render API", () => {
    const bridge = new PORenderBridge();
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    bridge.drawEllipse(mockCtx, 50, 50, 30, 20, {
      strokeColor: "#ff0000",
      backgroundColor: "transparent",
      strokeWidth: 1,
      roughness: 0,
    });

    expect(mockCtx.ellipse).toHaveBeenCalledWith(50, 50, 30, 20, 0, 0, Math.PI * 2);
    expect(mockCtx.stroke).toHaveBeenCalled();
  });
});
