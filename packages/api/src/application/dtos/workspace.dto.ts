import { SceneState } from '../../domain/value-objects/scene-state.vo';
import { AppState } from '../../domain/value-objects/scene-state.vo';

// ---------------------------------------------------------------------------
// Input DTOs (Application layer boundary — validated before entering service)
// ---------------------------------------------------------------------------

/**
 * Used by POST /workspaces
 * No auth required — guests can create boards freely.
 */
export interface CreateWorkspaceDto {
  name: string;
  elements?: SceneState['elements'];
  appState?: AppState;
  files?: Record<string, any>;
}

/**
 * Used by Kafka consumer processing `whiteboard:element_update` events
 * coming from the realtime-hub's outgoing topic.
 *
 * senderId: For guests, this is a generated session UUID (no auth).
 *           For authenticated users, this is the user UUID from core/workspace auth.
 * clientVersion: The version the client believes is current (OCC check).
 */
export interface ElementUpdateDto {
  workspaceId: string;
  senderId: string;
  clientVersion: number;
  patch: {
    elements?: SceneState['elements'];
    appState?: AppState;
    files?: Record<string, any>;
  };
}

/**
 * Used by POST /workspaces/:id/claim
 * REQUIRES authentication — userId is extracted from the JWT issued by
 * core/workspace/backend's auth system (same JWT_ACCESS_SECRET).
 *
 * linkedWorkspaceId: optional — links this board to the user's organizational
 *                    workspace in core/workspace/backend.
 */
export interface ClaimWorkspaceDto {
  workspaceId: string;
  userId: string;
  linkedWorkspaceId?: string;
}

/**
 * Used by realtime-hub Kafka events for collaborator presence.
 * senderId is a guest session UUID or an authenticated user UUID.
 */
export interface CollaboratorEventDto {
  workspaceId: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Output DTOs (what REST endpoints return)
// ---------------------------------------------------------------------------

export interface WorkspaceResponseDto {
  id: string;
  name: string;
  ownerId: string | null;
  isTemporary: boolean;
  linkedWorkspaceId: string | null;
  collaborators: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSceneResponseDto extends WorkspaceResponseDto {
  sceneState: SceneState;
}
