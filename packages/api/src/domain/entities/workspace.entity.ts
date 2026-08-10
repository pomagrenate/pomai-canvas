import { SceneState, AppState, emptySceneState } from '../value-objects/scene-state.vo';
import {
  WorkspaceAlreadyClaimedError,
  InvalidSceneUpdateError,
  UnauthorizedWorkspaceAccessError,
} from '../errors/domain.errors';

// ---------------------------------------------------------------------------
// Workspace Aggregate Root
// ---------------------------------------------------------------------------

/**
 * A Board is the PLG identity model for a whiteboard session.
 *
 * FREEMIUM MODEL:
 *   - isTemporary = true  → Guest board. ownerId is null. Stored in Redis with TTL.
 *                           Any anonymous user can create and collaborate.
 *   - isTemporary = false → Claimed board. ownerId is a real user UUID from
 *                           core/workspace/backend. Stored in Postgres.
 *
 * RELATIONSHIP WITH core/workspace/backend:
 *   When a board is claimed, `linkedWorkspaceId` is optionally set to a
 *   Workspace ID from the core workspace service. This links the whiteboard
 *   to an organizational workspace (team, project). The core workspace owns
 *   the user identity and authorization — we reference it but do not duplicate it.
 */

export type WorkspaceId = string; // UUID v4
export type UserId = string;      // UUID v4 — from core/workspace/backend auth system

export interface WorkspaceProps {
  id: WorkspaceId;
  name: string;

  /**
   * null   = guest-owned temporary board
   * string = authenticated user UUID (from core/workspace auth JWT sub claim)
   */
  ownerId: UserId | null;

  /**
   * true  = ephemeral, stored in Redis with TTL (no login required)
   * false = persistent, stored in Postgres (claimed by a logged-in user)
   */
  isTemporary: boolean;

  /**
   * Optional link to a core Workspace entity.
   * Set when a logged-in user claims this board — connects it to their
   * organizational workspace in core/workspace/backend.
   */
  linkedWorkspaceId: string | null;

  /**
   * List of user IDs who have actively joined this session.
   * For anonymous guests, this contains generated guest session IDs.
   */
  collaborators: UserId[];

  sceneState: SceneState;

  /**
   * Monotonically increasing version counter.
   * Used for optimistic concurrency control — each applySceneUpdate increments it.
   * The client must supply the current version to detect stale updates.
   */
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

export class Workspace {
  private readonly props: WorkspaceProps;

  private constructor(props: WorkspaceProps) {
    this.props = props;
  }

  // ---------------------------------------------------------------------------
  // Factory Methods
  // ---------------------------------------------------------------------------

  /**
   * Creates a new temporary (guest) workspace.
   * No authentication required — anyone can call this.
   */
  static createTemporary(params: { id: WorkspaceId; name: string }): Workspace {
    return new Workspace({
      id: params.id,
      name: params.name,
      ownerId: null,
      isTemporary: true,
      linkedWorkspaceId: null,
      collaborators: [],
      sceneState: emptySceneState(),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Reconstitutes a Workspace from a raw DB/cache snapshot.
   * Used by repositories when loading from Redis or Postgres.
   */
  static reconstitute(props: WorkspaceProps): Workspace {
    return new Workspace({ ...props });
  }

  // ---------------------------------------------------------------------------
  // Domain Methods (Business Rules live here — NOT in the service layer)
  // ---------------------------------------------------------------------------

  /**
   * DOMAIN RULE: Claim this workspace for a logged-in user.
   *
   * PLG Flow: Guest creates board → works → decides to save → logs in →
   *           frontend calls POST /workspaces/:id/claim → this method runs.
   *
   * After claiming:
   *   - ownerId is set to the authenticated user's ID (from core/workspace JWT)
   *   - isTemporary becomes false → repository.promote() migrates Redis → Postgres
   *   - linkedWorkspaceId is optionally set to link to the user's organizational workspace
   *
   * @throws WorkspaceAlreadyClaimedError if ownerId is already set
   */
  claim(userId: UserId, linkedWorkspaceId?: string): void {
    if (this.props.ownerId !== null) {
      throw new WorkspaceAlreadyClaimedError(this.props.id);
    }
    this.props.ownerId = userId;
    this.props.isTemporary = false;
    this.props.linkedWorkspaceId = linkedWorkspaceId ?? null;

    // Ensure the claimer is in collaborators if not already present
    if (!this.props.collaborators.includes(userId)) {
      this.props.collaborators.push(userId);
    }

    this.props.updatedAt = new Date();
  }

  /**
   * DOMAIN RULE: Apply a validated scene patch.
   *
   * Anyone in the session (guest or authenticated) can update elements —
   * the whiteboard is open by default. Authorization checks (for claimed boards)
   * are enforced at the service layer before calling this method.
   *
   * Version is incremented on every successful update (OCC).
   *
   * @throws InvalidSceneUpdateError if the patch has no elements and no appState
   */
  applySceneUpdate(patch: { elements?: SceneState['elements']; appState?: AppState; files?: Record<string, any> }): void {
    if (!patch.elements && !patch.appState && !patch.files) {
      throw new InvalidSceneUpdateError('Patch must contain at least elements, appState, or files.');
    }

    if (patch.elements !== undefined) {
      this.props.sceneState.elements = patch.elements;
    }
    if (patch.appState !== undefined) {
      this.props.sceneState.appState = {
        ...this.props.sceneState.appState,
        ...patch.appState,
      };
    }
    if (patch.files !== undefined) {
      this.props.sceneState.files = {
        ...this.props.sceneState.files,
        ...patch.files,
      };
    }

    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  /**
   * DOMAIN RULE: Register a collaborator in this session.
   * Idempotent — calling multiple times with same ID is safe.
   */
  addCollaborator(userId: UserId): void {
    if (!this.props.collaborators.includes(userId)) {
      this.props.collaborators.push(userId);
    }
  }

  removeCollaborator(userId: UserId): void {
    this.props.collaborators = this.props.collaborators.filter(id => id !== userId);
  }

  /**
   * DOMAIN RULE: Check if a user can write to this workspace.
   *
   * - Temporary (guest) boards: OPEN to everyone. Any session ID can write.
   * - Claimed boards: Only the owner or existing collaborators can write.
   *   (The service layer must pass the authenticated userId.)
   */
  canWrite(userId: UserId | null): boolean {
    if (this.props.isTemporary) return true; // Always open
    if (userId === null) return false;        // Unauthenticated cannot write to claimed boards
    return (
      this.props.ownerId === userId ||
      this.props.collaborators.includes(userId)
    );
  }

  // ---------------------------------------------------------------------------
  // Getters (read-only external interface)
  // ---------------------------------------------------------------------------

  get id(): WorkspaceId { return this.props.id; }
  get name(): string { return this.props.name; }
  get ownerId(): UserId | null { return this.props.ownerId; }
  get isTemporary(): boolean { return this.props.isTemporary; }
  get linkedWorkspaceId(): string | null { return this.props.linkedWorkspaceId; }
  get collaborators(): UserId[] { return [...this.props.collaborators]; }
  get sceneState(): SceneState { return this.props.sceneState; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * Returns a plain object snapshot for serialization.
   * Used by repositories to persist to Redis/Postgres.
   */
  toSnapshot(): WorkspaceProps {
    return {
      ...this.props,
      collaborators: [...this.props.collaborators],
      sceneState: {
        elements: [...this.props.sceneState.elements],
        appState: { ...this.props.sceneState.appState },
        files: { ...this.props.sceneState.files },
      },
    };
  }
}
