/**
 * SkSL GPU Shader Engine
 * Utilizes CanvasKit WebGL context to render complex shader effects (neon, glassmorphism)
 * and blast them back onto the main Excalidraw 2D canvas.
 */

// @ts-ignore
const CanvasKitInit = require("./wasm/canvaskit.js");
// @ts-ignore
import canvaskitWasm from "./wasm/canvaskit.wasm";
// @ts-ignore
import canvaskitWasm from "./wasm/canvaskit.wasm";

let canvasKitInstance: any = null;
let initPromise: Promise<any> | null = null;
let skslSurface: any = null;
let hiddenCanvas: HTMLCanvasElement | null = null;

export async function initCanvasKit() {
  if (canvasKitInstance) return canvasKitInstance;
  if (!initPromise) {
    initPromise = CanvasKitInit({
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) return canvaskitWasm;
        return file;
      }
    }).then((ck: any) => {
      canvasKitInstance = ck;
      return ck;
    }).catch((err: any) => {
      console.error("[CanvasKit] Failed to initialize:", err);
      return null;
    });
  }
  return initPromise;
}

// Pre-initialize on load!
initCanvasKit();

export function getSkslSurfaceSync(width: number, height: number): {surface: any, canvas: HTMLCanvasElement} | null {
  const CanvasKit = canvasKitInstance;
  if (!CanvasKit) return null;

  if (!hiddenCanvas) {
    hiddenCanvas = document.createElement('canvas');
    // Ensure the WebGL canvas has hardware acceleration enabled
    hiddenCanvas.width = width;
    hiddenCanvas.height = height;
    skslSurface = CanvasKit.MakeWebGLCanvasSurface(hiddenCanvas, null, {
        alpha: true,
        antialias: 1,
        depth: 0,
        stencil: 8,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
    });
  } else {
    // Resize if needed
    if (hiddenCanvas.width < width || hiddenCanvas.height < height) {
      hiddenCanvas.width = Math.max(hiddenCanvas.width, width);
      hiddenCanvas.height = Math.max(hiddenCanvas.height, height);
      if (skslSurface) skslSurface.delete();
      skslSurface = CanvasKit.MakeWebGLCanvasSurface(hiddenCanvas, null, {
        alpha: true,
        antialias: 1,
        depth: 0,
        stencil: 8,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      });
    }
  }

  if (!skslSurface) {
    console.warn("Failed to initialize CanvasKit WebGL Surface.");
    return null;
  }

  return { surface: skslSurface, canvas: hiddenCanvas };
}

// Predefined SkSL Shaders
const SHADERS = {
  neon: `
    uniform float2 resolution;
    uniform float time;
    uniform vec4 color;

    half4 main(float2 fragCoord) {
        float dist = length(fragCoord - resolution * 0.5);
        float glow = 1.0 / (dist * 0.05 + 1.0);
        glow *= 0.8 + 0.2 * sin(time * 3.0);
        return half4(color.rgb * glow, glow * color.a);
    }
  `,
  gradient_mesh: `
    uniform float2 resolution;
    uniform float time;
    uniform vec4 color;

    half4 main(float2 fragCoord) {
        float2 uv = fragCoord.xy / resolution.xy;
        float r = 0.5 + 0.5 * cos(time + uv.x * 10.0);
        float g = 0.5 + 0.5 * cos(time + uv.y * 10.0 + 2.0);
        float b = 0.5 + 0.5 * cos(time + (uv.x + uv.y) * 10.0 + 4.0);
        return half4(r * color.r, g * color.g, b * color.b, color.a);
    }
  `
};

/**
 * Renders an Excalidraw element onto the WebGL CanvasKit surface using a given SkSL shader synchronously.
 */
export function renderShaderElementSync(
  width: number,
  height: number,
  shaderType: 'neon' | 'gradient_mesh',
  drawCallback: (canvas: any, paint: any) => void
): HTMLCanvasElement | null {
  const CanvasKit = canvasKitInstance;
  if (!CanvasKit) return null; // Fall back to standard rendering if WASM not loaded

  const surfaceData = getSkslSurfaceSync(width, height);
  if (!surfaceData) return null;

  const { surface, canvas } = surfaceData;
  const skCanvas = surface.getCanvas();

  // Clear previous frame
  skCanvas.clear(CanvasKit.TRANSPARENT);

  const shaderCode = SHADERS[shaderType];
  const effect = CanvasKit.RuntimeEffect.Make(shaderCode);
  
  if (!effect) {
    console.error(`Failed to compile SkSL shader: ${shaderType}`);
    return null;
  }

  const timeSecs = Date.now() / 1000.0;
  const uniforms = Float32Array.of(width, height, timeSecs, 1.0, 1.0, 1.0, 1.0);
  
  const shader = effect.makeShader(uniforms);
  
  const paint = new CanvasKit.Paint();
  paint.setShader(shader);
  paint.setAntiAlias(true);
  paint.setStyle(CanvasKit.PaintStyle.Fill);

  drawCallback(skCanvas, paint);

  surface.flush();
  
  shader.delete();
  paint.delete();
  effect.delete();

  return canvas;
}
