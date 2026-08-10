import { Workspace } from '../entities/workspace.entity';

/**
 * IWorkspaceRepository — Domain Port (Dependency Inversion)
 *
 * This interface is the contract between the Application layer and the
 * Infrastructure layer. The Application/Service layer depends ONLY on this
 * interface, never on concrete Redis or Postgres implementations.
 *
 * ROUTING STRATEGY (implemented by CompositeWorkspaceRepository):
 *   findById  → searches Redis first (fast path for temporary), falls back to Postgres
 *   save      → routes to Redis (isTemporary=true, with TTL) or Postgres (isTemporary=false)
 *   promote   → atomic two-phase: Redis DEL → Postgres INSERT (used by claimWorkspace)
 *   delete    → removes from whichever store holds the record
 */
export interface IWorkspaceRepository {
  /**
   * Find a workspace by ID.
   * Implementation searches Redis first, then Postgres.
   * Returns null if not found in either store.
   */
  findById(id: string): Promise<Workspace | null>;

  /**
   * Persist a workspace.
   *
   * - If workspace.isTemporary === true  → upsert into Redis with TTL
   * - If workspace.isTemporary === false → upsert into Postgres
   *
   * The implementation decides the store; the caller doesn't need to know.
   */
  save(workspace: Workspace): Promise<void>;

  /**
   * Atomic promotion: move a workspace from Redis (temporary) to Postgres (persistent).
   *
   * This is the critical path for the PLG "claim" use case:
   *   1. Delete the workspace from Redis
   *   2. Insert it into Postgres (within a transaction if possible)
   *
   * The workspace passed in MUST already have isTemporary=false and ownerId set
   * (i.e., workspace.claim() must have been called before calling this method).
   *
   * @throws Error if the workspace is still marked as temporary
   */
  promote(workspace: Workspace): Promise<void>;

  /**
   * Delete a workspace from whichever store it lives in.
   * Used for cleanup of abandoned guest sessions.
   */
  delete(id: string): Promise<void>;

  /**
   * Find all claimed workspaces owned by a specific user.
   */
  findByOwnerId(ownerId: string): Promise<Workspace[]>;
}

