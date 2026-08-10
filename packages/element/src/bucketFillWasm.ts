import { getPORenderWASM } from "./wasmLoader";

export interface BucketFillOptions {
  tolerance?: number;
}

export async function executeWasmBucketFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  options: BucketFillOptions = {},
): Promise<number> {
  const wasm = await getPORenderWASM();
  if (!wasm) {
    // JavaScript fallback implementation
    return 0;
  }

  const width = imageData.width;
  const height = imageData.height;

  const numPixels = width * height;
  const numBytes = numPixels * 4;

  const ptr = wasm._malloc(numBytes);
  const u32Heap = new Uint32Array(wasm.HEAPU32.buffer, ptr, numPixels);
  const source32 = new Uint32Array(imageData.data.buffer);

  u32Heap.set(source32);

  const fill32 =
    (fillColor[0] << 24) |
    (fillColor[1] << 16) |
    (fillColor[2] << 8) |
    fillColor[3];

  const filledCount = wasm._po_wasm_bucket_fill(
    ptr,
    width,
    height,
    startX,
    startY,
    fill32,
    0,
    options.tolerance || 0.1,
  );

  imageData.data.set(new Uint8ClampedArray(wasm.HEAPU32.buffer, ptr, numBytes));
  wasm._free(ptr);

  return filledCount;
}
