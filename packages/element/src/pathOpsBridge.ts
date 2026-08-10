/**
 * True Skia PathOps Bridge.
 * Uses official CanvasKit (Skia WASM) for high-performance Boolean Geometry.
 */

// @ts-ignore
import CanvasKitInit from "./wasm/canvaskit.js";
// @ts-ignore
import canvaskitWasm from "./wasm/canvaskit.wasm";

let canvasKitInstance: any = null;
let initPromise: Promise<any> | null = null;

export async function getCanvasKit() {
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

/**
 * Merges two SVG paths using Skia SkPathOps.
 * @param svgPathA The first SVG path string.
 * @param svgPathB The second SVG path string.
 * @param op The boolean operation to perform ('union', 'intersect', 'difference', 'reverseDifference', 'xor').
 * @returns The resulting SVG path string, or empty string on failure.
 */
export async function mergeShapes(
  svgPathA: string,
  svgPathB: string,
  op: 'union' | 'intersect' | 'difference' | 'reverseDifference' | 'xor' = 'union'
): Promise<string> {
  const CanvasKit = await getCanvasKit();
  if (!CanvasKit) return "";

  const pathA = CanvasKit.Path.MakeFromSVGString(svgPathA);
  const pathB = CanvasKit.Path.MakeFromSVGString(svgPathB);

  if (!pathA || !pathB) {
    if (pathA) pathA.delete();
    if (pathB) pathB.delete();
    return "";
  }

  let pathOp = CanvasKit.PathOp.Union;
  switch (op) {
    case 'intersect':
      pathOp = CanvasKit.PathOp.Intersect;
      break;
    case 'difference':
      pathOp = CanvasKit.PathOp.Difference;
      break;
    case 'reverseDifference':
      pathOp = CanvasKit.PathOp.ReverseDifference;
      break;
    case 'xor':
      pathOp = CanvasKit.PathOp.XOR;
      break;
  }

  const resultPath = CanvasKit.Path.MakeFromOp(pathA, pathB, pathOp);
  
  // Cleanup original paths from WASM memory
  pathA.delete();
  pathB.delete();

  if (resultPath) {
    const resultSvg = resultPath.toSVGString();
    resultPath.delete();
    return resultSvg;
  }

  return "";
}
