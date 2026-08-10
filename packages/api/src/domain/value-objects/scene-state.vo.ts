/**
 * SceneState Value Object
 *
 * Mirrors the Excalidraw element structure used by the frontend submodule.
 * This is intentionally a loose type — the backend treats scene data as an
 * opaque JSON payload it stores and rebroadcasts. The frontend (excalidraw)
 * is responsible for deep validation of element shapes.
 *
 * Future: if strict server-side element validation is needed, import
 * shared Zod schemas here.
 */

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  roundness: null | { type: number; value?: number };
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: Array<{ type: string; id: string }> | null;
  updated: number;
  link: string | null;
  locked: boolean;
  [key: string]: unknown; // allow custom excalidraw extensions
}

export interface AppState {
  viewBackgroundColor?: string;
  zoom?: { value: number };
  scrollX?: number;
  scrollY?: number;
  [key: string]: unknown;
}

/**
 * SceneState is the root payload of the whiteboard canvas.
 * elements: the list of all drawable objects on the canvas.
 * appState: viewport/camera settings.
 */
export interface SceneState {
  elements: ExcalidrawElement[];
  appState: AppState;
  files: Record<string, any>;
}

export const emptySceneState = (): SceneState => ({
  elements: [],
  appState: {},
  files: {},
});
