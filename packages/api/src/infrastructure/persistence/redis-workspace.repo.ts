import { Redis } from 'ioredis';

import { Workspace, WorkspaceProps } from '../../domain/entities/workspace.entity';
import { IWorkspaceRepository } from '../../domain/ports/workspace-repository.port';

/**
 * RedisWorkspaceRepository — Temporary workspace store
 *
 * Stores guest (temporary) workspaces with a TTL of 24 hours.
 * If not claimed within TTL, Redis automatically evicts the key — 
 * no manual cleanup needed.
 *
 * Key pattern: `whiteboard:workspace:{workspaceId}`
 * TTL: 86400 seconds (24 hours) — refreshed on every save
 */
export class RedisWorkspaceRepository implements IWorkspaceRepository {
  private static readonly KEY_PREFIX = 'whiteboard:workspace:';
  private static readonly TTL_SECONDS = 86400; // 24 hours

  constructor(private readonly redis: Redis) {}

  private key(id: string): string {
    return `${RedisWorkspaceRepository.KEY_PREFIX}${id}`;
  }

  async findById(id: string): Promise<Workspace | null> {
    const raw = await this.redis.get(this.key(id));
    if (!raw) return null;

    const props = JSON.parse(raw) as WorkspaceProps;
    // Deserialize Date strings back to Date objects
    props.createdAt = new Date(props.createdAt);
    props.updatedAt = new Date(props.updatedAt);

    return Workspace.reconstitute(props);
  }

  async save(workspace: Workspace): Promise<void> {
    const snapshot = workspace.toSnapshot();
    await this.redis.setex(
      this.key(workspace.id),
      RedisWorkspaceRepository.TTL_SECONDS,
      JSON.stringify(snapshot),
    );
  }

  async promote(_workspace: Workspace): Promise<void> {
    // Promotion (Redis → Postgres) is handled by CompositeWorkspaceRepository.
    // This method should not be called directly on RedisWorkspaceRepository.
    throw new Error('RedisWorkspaceRepository.promote() is not supported. Use CompositeWorkspaceRepository.');
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(this.key(id));
  }

  async findByOwnerId(_ownerId: string): Promise<Workspace[]> {
    // Redis stores temporary guest workspaces only (ownerId = null)
    return [];
  }
}

