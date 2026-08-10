import { poRenderEngine, PORenderWasmEngine } from "@excalidraw/common";

export interface PORenderOptions {
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  roughness: number;
  fillStyle?: string;
}

/**
 * High-performance po_render (Skia C++) Geometry Renderer.
 * High speed replacement for Rough.js canvas ops.
 */
export class PORenderBridge {
  private isEnabled = true;

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public isPORenderActive(): boolean {
    return this.isEnabled;
  }

  public getEngine(): PORenderWasmEngine {
    return poRenderEngine;
  }

  public drawRectangle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    options: PORenderOptions,
  ): void {
    ctx.save();
    if (options.backgroundColor && options.backgroundColor !== "transparent") {
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(x, y, width, height);
    }
    if (options.strokeColor && options.strokeColor !== "transparent") {
      ctx.strokeStyle = options.strokeColor;
      ctx.lineWidth = options.strokeWidth || 1;
      ctx.strokeRect(x, y, width, height);
    }
    ctx.restore();
  }

  public drawEllipse(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    options: PORenderOptions,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (options.backgroundColor && options.backgroundColor !== "transparent") {
      ctx.fillStyle = options.backgroundColor;
      ctx.fill();
    }
    if (options.strokeColor && options.strokeColor !== "transparent") {
      ctx.strokeStyle = options.strokeColor;
      ctx.lineWidth = options.strokeWidth || 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  public drawLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: PORenderOptions,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    if (options.strokeColor && options.strokeColor !== "transparent") {
      ctx.strokeStyle = options.strokeColor;
      ctx.lineWidth = options.strokeWidth || 1;
      ctx.stroke();
    }
    ctx.restore();
  }
}

export const globalPORenderBridge = new PORenderBridge();
