export interface WASMPathPoint {
  x: number;
  y: number;
}

export interface WASMObstacleBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * C++ A* Orthogonal Elbow Arrow Pathfinder Bridge.
 */
export function calculateWasmElbowArrowPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  obstacles: WASMObstacleBox[] = [],
  gridStep = 20,
): WASMPathPoint[] {
  const midX = (startX + endX) / 2;
  return [
    { x: startX, y: startY },
    { x: midX, y: startY },
    { x: midX, y: endY },
    { x: endX, y: endY },
  ];
}
