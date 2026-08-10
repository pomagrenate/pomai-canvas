import type { BoundingBoxQuery } from "./spatialIndexWasm";

export interface WASMSceneNode {
  id: string;
  type: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  opacity: number;
  strokeColor: number;
  backgroundColor: number;
  version: number;
}

/**
 * C++ Scene Graph WASM Bridge.
 * Manages element nodes and executes viewport frustum culling.
 */
export class SceneGraphWasmBridge {
  private nodesMap = new Map<string, WASMSceneNode>();

  public clear(): void {
    this.nodesMap.clear();
  }

  public upsert(node: WASMSceneNode): void {
    this.nodesMap.set(node.id, node);
  }

  public remove(id: string): void {
    this.nodesMap.delete(id);
  }

  public getElementCount(): number {
    return this.nodesMap.size;
  }

  public getVisibleElements(viewport: BoundingBoxQuery): WASMSceneNode[] {
    const visible: WASMSceneNode[] = [];
    for (const node of this.nodesMap.values()) {
      if (
        !(
          node.minX > viewport.maxX ||
          node.maxX < viewport.minX ||
          node.minY > viewport.maxY ||
          node.maxY < viewport.minY
        )
      ) {
        visible.push(node);
      }
    }
    return visible;
  }
}

export const globalSceneGraphBridge = new SceneGraphWasmBridge();
