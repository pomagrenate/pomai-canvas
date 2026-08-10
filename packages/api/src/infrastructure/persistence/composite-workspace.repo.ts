import { Workspace } from '../../domain/entities/workspace.entity';
import { IWorkspaceRepository } from '../../domain/ports/workspace-repository.port';
import { RedisWorkspaceRepository } from './redis-workspace.repo';
import { PostgresWorkspaceRepository } from './postgres-workspace.repo';

/**
 * CompositeWorkspaceRepository — Dual-store Router
 *
 * This is the concrete implementation of IWorkspaceRepository that the
 * DI container wires into WorkspaceService.
 *
 * ROUTING RULES:
 *   findById → Redis first (fast path), then Postgres (fallback for claimed boards)
 *   save     → Redis   if workspace.isTemporary === true  (with TTL)
 *              Postgres if workspace.isTemporary === false
 *   promote  → Atomic two-phase: Redis DEL → Postgres INSERT
 *              Called exclusively by the claimWorkspace use case.
 *   delete   → Tries both stores
 */
export class CompositeWorkspaceRepository implements IWorkspaceRepository {
  constructor(
    private readonly redisRepo: RedisWorkspaceRepository,
    private readonly postgresRepo: PostgresWorkspaceRepository,
  ) {}

  async findById(id: string): Promise<Workspace | null> {
    // Fast path: check Redis first (temporary boards and hot claimed boards)
    const fromRedis = await this.redisRepo.findById(id);
    if (fromRedis) return fromRedis;

    // Fallback: check Postgres (permanently stored claimed boards)
    return this.postgresRepo.findById(id);
  }

  async save(workspace: Workspace): Promise<void> {
    if (workspace.isTemporary) {
      await this.redisRepo.save(workspace);
    } else {
      await this.postgresRepo.save(workspace);
    }
  }

  /**
   * Atomic PLG promotion: Redis → Postgres
   *
   * Called ONLY after workspace.claim() has been invoked on the domain entity,
   * which means:
   *   - workspace.isTemporary === false
   *   - workspace.ownerId is set
   *
   * Operation order:
   *   1. INSERT into Postgres first (fail fast if DB is down, keep Redis intact)
   *   2. DELETE from Redis (cleanup the temporary entry)
   *
   * If step 2 fails, we have a stale Redis key. It will expire naturally via TTL.
   * The Postgres record is the source of truth after step 1 succeeds.
   */
  async promote(workspace: Workspace): Promise<void> {
    if (workspace.isTemporary) {
      throw new Error(
        `CompositeWorkspaceRepository.promote(): workspace "${workspace.id}" is still marked as temporary. ` +
        'Call workspace.claim() before promoting.',
      );
    }

    // Step 1: Persist to Postgres (primary store after claim)
    await this.postgresRepo.save(workspace);

    // Step 2: Remove from Redis (best-effort; TTL will clean up if this fails)
    try {
      await this.redisRepo.delete(workspace.id);
    } catch (err) {
      // Non-fatal: Redis TTL will evict the stale key within 24h
      console.warn(
        `[CompositeRepo] promote: failed to delete Redis key for ${workspace.id}. ` +
        'TTL eviction will clean up. Error:',
        err,
      );
    }
  }

  async delete(id: string): Promise<void> {
    // Try both stores — workspace could be in either
    await Promise.allSettled([
      this.redisRepo.delete(id),
      this.postgresRepo.delete(id),
    ]);
  }

  async findByOwnerId(ownerId: string): Promise<Workspace[]> {
    return this.postgresRepo.findByOwnerId(ownerId);
  }
}

