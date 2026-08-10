import { Pool } from 'pg';

import { Workspace, WorkspaceProps } from '../../domain/entities/workspace.entity';
import { IWorkspaceRepository } from '../../domain/ports/workspace-repository.port';

/**
 * PostgresWorkspaceRepository — Persistent workspace store
 *
 * Stores claimed (persistent) workspaces in the `pomaiwhiteboard` Postgres database.
 * Uses the shared `postgres` container from infrastructure/docker-compose.yml.
 *
 * Table: whiteboard_workspaces
 * sceneState and collaborators are stored as JSONB for flexibility.
 */
export class PostgresWorkspaceRepository implements IWorkspaceRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Workspace | null> {
    const result = await this.pool.query(
      `SELECT id, name, owner_id, is_temporary, linked_workspace_id,
              collaborators, scene_state, version, created_at, updated_at
       FROM whiteboard_workspaces
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const props: WorkspaceProps = {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      isTemporary: row.is_temporary,
      linkedWorkspaceId: row.linked_workspace_id,
      collaborators: row.collaborators ?? [],
      sceneState: row.scene_state,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };

    return Workspace.reconstitute(props);
  }

  async save(workspace: Workspace): Promise<void> {
    const snap = workspace.toSnapshot();

    await this.pool.query(
      `INSERT INTO whiteboard_workspaces
         (id, name, owner_id, is_temporary, linked_workspace_id,
          collaborators, scene_state, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name               = EXCLUDED.name,
         owner_id           = EXCLUDED.owner_id,
         is_temporary       = EXCLUDED.is_temporary,
         linked_workspace_id = EXCLUDED.linked_workspace_id,
         collaborators      = EXCLUDED.collaborators,
         scene_state        = EXCLUDED.scene_state,
         version            = EXCLUDED.version,
         updated_at         = EXCLUDED.updated_at`,
      [
        snap.id,
        snap.name,
        snap.ownerId,
        snap.isTemporary,
        snap.linkedWorkspaceId,
        JSON.stringify(snap.collaborators),
        JSON.stringify(snap.sceneState),
        snap.version,
        snap.createdAt.toISOString(),
        snap.updatedAt.toISOString(),
      ],
    );
  }

  async promote(_workspace: Workspace): Promise<void> {
    // Direct promotion not applicable here. Handled by CompositeWorkspaceRepository.
    throw new Error('PostgresWorkspaceRepository.promote() is not supported. Use CompositeWorkspaceRepository.');
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM whiteboard_workspaces WHERE id = $1',
      [id],
    );
  }

  async findByOwnerId(ownerId: string): Promise<Workspace[]> {
    const result = await this.pool.query(
      `SELECT id, name, owner_id, is_temporary, linked_workspace_id,
              collaborators, scene_state, version, created_at, updated_at
       FROM whiteboard_workspaces
       WHERE owner_id = $1
       ORDER BY updated_at DESC`,
      [ownerId],
    );

    return result.rows.map((row) => {
      const props: WorkspaceProps = {
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        isTemporary: row.is_temporary,
        linkedWorkspaceId: row.linked_workspace_id,
        collaborators: row.collaborators ?? [],
        sceneState: row.scene_state,
        version: row.version,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
      return Workspace.reconstitute(props);
    });
  }
}

