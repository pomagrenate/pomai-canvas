// @ts-ignore
import PORenderModule from "./wasm/po_render.js";

export interface PORenderWASMInstance {
  _po_wasm_bucket_fill: (
    pixelPtr: number,
    width: number,
    height: number,
    startX: number,
    startY: number,
    fillColor: number,
    targetColor: number,
    tolerance: number
  ) => number;
  _po_wasm_spatial_clear: () => void;
  _po_wasm_spatial_insert: (minX: number, minY: number, maxX: number, maxY: number) => void;
  _po_wasm_render_rectangle: (
    pixelPtr: number,
    width: number,
    height: number,
    x: number,
    y: number,
    w: number,
    h: number,
    strokeColor: number,
    backgroundColor: number,
    strokeWidth: number
  ) => void;
  _malloc: (bytes: number) => number;
  _free: (ptr: number) => void;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
}

let wasmInstance: PORenderWASMInstance | null = null;
let initPromise: Promise<PORenderWASMInstance | null> | null = null;

/**
 * Validates WebAssembly support in the current runtime environment.
 */
export function isWasmSupported(): boolean {
  try {
    if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
      const module = new WebAssembly.Module(
        Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
      );
      return module instanceof WebAssembly.Module;
    }
  } catch (e) {
    return false;
  }
  return false;
}

/**
 * Initializes and returns the compiled C++ WASM module instance with graceful fallback.
 */
export async function getPORenderWASM(): Promise<PORenderWASMInstance | null> {
  if (!isWasmSupported()) {
    console.warn("[po_render] WebAssembly is not supported on this browser/environment. Using JavaScript fallback.");
    return null;
  }

  if (wasmInstance) {
    return wasmInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const mod = await PORenderModule();
        wasmInstance = mod as unknown as PORenderWASMInstance;
        return wasmInstance;
      } catch (err) {
        console.warn("[po_render] Failed to load WASM binary. Falling back to JavaScript engine:", err);
        return null;
      }
    })();
  }

  return initPromise;
}
