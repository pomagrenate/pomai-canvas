export interface Point2D {
  x: number;
  y: number;
}

export interface PathVertexBuffer {
  vertexCount: number;
  // Flat Float32Array containing [x0, y0, x1, y1, ...] binary vertex stream
  flatVertices: Float32Array;
}

/**
 * Generate binary vertex buffers for jittered lines.
 * Bypasses string allocations during rendering.
 */
export function generateBinaryJitteredLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  roughness = 1.0,
  seed = 42,
): PathVertexBuffer {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  const steps = Math.max(2, Math.floor(len / 10));
  const vertexCount = steps + 1;
  const flatVertices = new Float32Array(vertexCount * 2);

  let currentSeed = seed;
  const pseudoRandom = () => {
    currentSeed = (Math.imul(currentSeed, 1664525) + 1013904223) >>> 0;
    return currentSeed / 4294967295;
  };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let px = x1 + t * dx;
    let py = y1 + t * dy;

    if (i > 0 && i < steps && roughness > 0) {
      px += (pseudoRandom() - 0.5) * roughness * 2;
      py += (pseudoRandom() - 0.5) * roughness * 2;
    }

    flatVertices[i * 2] = px;
    flatVertices[i * 2 + 1] = py;
  }

  return {
    vertexCount,
    flatVertices,
  };
}

/**
 * Generate binary vertex buffers for jittered rectangles.
 */
export function generateBinaryJitteredRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  roughness = 1.0,
  seed = 42,
): PathVertexBuffer {
  const top = generateBinaryJitteredLine(x, y, x + width, y, roughness, seed);
  const right = generateBinaryJitteredLine(x + width, y, x + width, y + height, roughness, seed + 1);
  const bottom = generateBinaryJitteredLine(x + width, y + height, x, y + height, roughness, seed + 2);
  const left = generateBinaryJitteredLine(x, y + height, x, y, roughness, seed + 3);

  const totalVertices = top.vertexCount + right.vertexCount + bottom.vertexCount + left.vertexCount;
  const flatVertices = new Float32Array(totalVertices * 2);

  flatVertices.set(top.flatVertices, 0);
  flatVertices.set(right.flatVertices, top.flatVertices.length);
  flatVertices.set(bottom.flatVertices, top.flatVertices.length + right.flatVertices.length);
  flatVertices.set(left.flatVertices, top.flatVertices.length + right.flatVertices.length + bottom.flatVertices.length);

  return {
    vertexCount: totalVertices,
    flatVertices,
  };
}
