import { randomUUID } from 'crypto';

import { Workspace } from '../../domain/entities/workspace.entity';
import { IWorkspaceRepository } from '../../domain/ports/workspace-repository.port';
import {
  IRealtimePort,
  RealtimeEvent,
  SceneUpdatedPayload,
  WorkspaceClaimedPayload,
  CollaboratorJoinedPayload,
  CollaboratorLeftPayload,
} from '../../domain/ports/realtime.port';
import {
  WorkspaceNotFoundError,
  UnauthorizedWorkspaceAccessError,
} from '../../domain/errors/domain.errors';
import {
  CreateWorkspaceDto,
  ElementUpdateDto,
  ClaimWorkspaceDto,
  CollaboratorEventDto,
  WorkspaceResponseDto,
  WorkspaceSceneResponseDto,
} from '../dtos/workspace.dto';

// ---------------------------------------------------------------------------
// WorkspaceService — Application / Use Case Layer
//
// Orchestrates domain logic, repository I/O, and realtime event publishing.
// Does NOT contain business rules — those live in workspace.entity.ts.
// Does NOT know about Kafka, Redis, or Postgres specifics.
// ---------------------------------------------------------------------------

import { MinioFileService } from '../../infrastructure/storage/minio-file.service';

export class WorkspaceService {
  constructor(
    private readonly workspaceRepo: IWorkspaceRepository,
    private readonly realtimePort: IRealtimePort,
    private readonly fileService?: MinioFileService,
  ) {}

  // ---------------------------------------------------------------------------
  // USE CASE: Create a new whiteboard
  //
  // PLG RULE: No authentication required. Guests can create boards freely.
  // The created board is temporary (stored in Redis with TTL).
  // ---------------------------------------------------------------------------
  async createWorkspace(dto: CreateWorkspaceDto): Promise<WorkspaceResponseDto> {
    const workspace = Workspace.createTemporary({
      id: randomUUID(),
      name: dto.name,
    });

    if (dto.elements || dto.appState || dto.files) {
      workspace.applySceneUpdate({
        elements: dto.elements,
        appState: dto.appState,
        files: dto.files,
      });
    }

    await this.workspaceRepo.save(workspace);

    return this.toResponseDto(workspace);
  }

  // ---------------------------------------------------------------------------
  // USE CASE: Fetch a workspace (metadata + full scene state)
  //
  // Available to anyone with the workspace ID (share-by-link model).
  // ---------------------------------------------------------------------------
  async getWorkspace(workspaceId: string): Promise<WorkspaceSceneResponseDto> {
    const workspace = await this.findOrThrow(workspaceId);
    return this.toSceneResponseDto(workspace);
  }

  // ---------------------------------------------------------------------------
  // USE CASE: Handle an element update event from the realtime-hub
  //
  // Called by the Kafka consumer when it receives a `whiteboard:element_update`
  // event on topic `realtime-outgoing-events`.
  //
  // PLG FLOW:
  //   - Temporary boards: any guest session can update (senderId = guest session UUID)
  //   - Claimed boards:   senderId must be ownerId or collaborator
  //
  // OCC GUARD: If clientVersion doesn't match current version, reject the update.
  // The Kafka consumer will log the rejection; client will reconcile on next full sync.
  // ---------------------------------------------------------------------------
  async handleElementUpdate(dto: ElementUpdateDto): Promise<void> {
    const workspace = await this.findOrThrow(dto.workspaceId);

    // Authorization: domain method `canWrite` enforces the freemium rule
    if (!workspace.canWrite(dto.senderId)) {
      throw new UnauthorizedWorkspaceAccessError(dto.workspaceId, dto.senderId);
    }

    // Optimistic concurrency control: reject stale updates
    if (dto.clientVersion !== workspace.version) {
      // Not a hard error — client will re-sync. Log and skip.
      // In a future iteration, send a `whiteboard:sync_required` event back to the sender.
      return;
    }

    // Domain method enforces all business rules and increments version
    workspace.applySceneUpdate(dto.patch);
    await this.workspaceRepo.save(workspace);

    // Publish validated state to the realtime-hub for broadcasting to the ROOM
    const payload: SceneUpdatedPayload = {
      workspaceId: dto.workspaceId,
      version: workspace.version,
      patch: dto.patch,
    };

    const event: RealtimeEvent = {
      event_type: 'whiteboard:scene_updated',
      target_type: 'ROOM',
      target_id: dto.workspaceId,
      sender_id: dto.senderId,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.realtimePort.publish(event);
  }

  // ---------------------------------------------------------------------------
  // USE CASE: Claim a workspace (PLG "save" flow)
  //
  // REQUIRES: authenticated userId (from JWT issued by core/workspace/backend auth).
  //
  // ORCHESTRATION:
  //   1. Load workspace from Redis (it must currently be temporary)
  //   2. Call domain entity's claim() → enforces business rule (throws if already claimed)
  //   3. repository.promote() → atomic Redis DEL + Postgres INSERT
  //   4. Publish ownership change event to realtime-hub → all clients in the ROOM
  //      receive a `whiteboard:workspace_claimed` event and update their UI
  //
  // LINKED WORKSPACE:
  //   If the user provides a linkedWorkspaceId, the board is associated with
  //   their organizational workspace in core/workspace/backend. This enables
  //   workspace-level access control in future iterations.
  // ---------------------------------------------------------------------------
  async claimWorkspace(dto: ClaimWorkspaceDto): Promise<WorkspaceResponseDto> {
    const workspace = await this.findOrThrow(dto.workspaceId);

    // Domain method — throws WorkspaceAlreadyClaimedError if ownerId is set
    workspace.claim(dto.userId, dto.linkedWorkspaceId);

    // Atomic: delete from Redis, insert into Postgres
    // The repository validates that isTemporary=false before proceeding
    await this.workspaceRepo.promote(workspace);

    // Broadcast ownership change to all clients currently in this room
    const payload: WorkspaceClaimedPayload = {
      workspaceId: dto.workspaceId,
      ownerId: dto.userId,
      linkedWorkspaceId: dto.linkedWorkspaceId ?? null,
      isTemporary: false,
    };

    const event: RealtimeEvent = {
      event_type: 'whiteboard:workspace_claimed',
      target_type: 'ROOM',
      target_id: dto.workspaceId,
      sender_id: dto.userId,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.realtimePort.publish(event);

    return this.toResponseDto(workspace);
  }

  // ---------------------------------------------------------------------------
  // USE CASE: Register a collaborator joining the session
  //
  // Called by Kafka consumer on `whiteboard:collaborator_joined` events.
  // Works for both guests (session UUID) and authenticated users (user UUID).
  // ---------------------------------------------------------------------------
  async handleCollaboratorJoined(dto: CollaboratorEventDto): Promise<void> {
    const workspace = await this.findOrThrow(dto.workspaceId);
    workspace.addCollaborator(dto.userId);
    await this.workspaceRepo.save(workspace);

    const payload: CollaboratorJoinedPayload = {
      workspaceId: dto.workspaceId,
      userId: dto.userId,
    };

    const event: RealtimeEvent = {
      event_type: 'whiteboard:collaborator_joined',
      target_type: 'ROOM',
      target_id: dto.workspaceId,
      sender_id: dto.userId,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.realtimePort.publish(event);
  }

  // ---------------------------------------------------------------------------
  // USE CASE: Remove a collaborator leaving the session
  // ---------------------------------------------------------------------------
  async handleCollaboratorLeft(dto: CollaboratorEventDto): Promise<void> {
    const workspace = await this.findOrThrow(dto.workspaceId);
    workspace.removeCollaborator(dto.userId);
    await this.workspaceRepo.save(workspace);

    const payload: CollaboratorLeftPayload = {
      workspaceId: dto.workspaceId,
      userId: dto.userId,
    };

    const event: RealtimeEvent = {
      event_type: 'whiteboard:collaborator_left',
      target_type: 'ROOM',
      target_id: dto.workspaceId,
      sender_id: dto.userId,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.realtimePort.publish(event);
  }

  // ---------------------------------------------------------------------------
  // USE CASE: Export workspace to .excalidraw format (MinIO backup / download)
  // ---------------------------------------------------------------------------
  async exportExcalidrawFile(workspaceId: string): Promise<{ downloadUrl?: string; scene: object }> {
    const workspace = await this.findOrThrow(workspaceId);
    const scenePayload = {
      type: 'excalidraw',
      version: 2,
      source: 'pomaiwhiteboard',
      elements: workspace.sceneState.elements,
      appState: workspace.sceneState.appState,
      files: workspace.sceneState.files || {},
    };

    if (this.fileService) {
      const objectKey = await this.fileService.saveScene(
        workspace.id,
        workspace.version,
        scenePayload,
      );
      const downloadUrl = await this.fileService.getPresignedDownloadUrl(objectKey);
      return { downloadUrl, scene: scenePayload };
    }

    return { scene: scenePayload };
  }

  // ---------------------------------------------------------------------------
  // USE CASE: Get all claimed workspaces owned by a user
  // ---------------------------------------------------------------------------
  async getUserWorkspaces(userId: string): Promise<WorkspaceResponseDto[]> {
    const workspaces = await this.workspaceRepo.findByOwnerId(userId);
    return workspaces.map((w) => this.toResponseDto(w));
  }

  // ---------------------------------------------------------------------------
  // USE CASE: Delete a workspace owned by a user
  // ---------------------------------------------------------------------------
  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.findOrThrow(workspaceId);
    if (workspace.ownerId !== userId) {
      throw new UnauthorizedWorkspaceAccessError(workspaceId, userId);
    }
    await this.workspaceRepo.delete(workspaceId);
  }


  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async findOrThrow(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) throw new WorkspaceNotFoundError(workspaceId);
    return workspace;
  }

  private toResponseDto(workspace: Workspace): WorkspaceResponseDto {
    return {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.ownerId,
      isTemporary: workspace.isTemporary,
      linkedWorkspaceId: workspace.linkedWorkspaceId,
      collaborators: workspace.collaborators,
      version: workspace.version,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };
  }

  private toSceneResponseDto(workspace: Workspace): WorkspaceSceneResponseDto {
    return {
      ...this.toResponseDto(workspace),
      sceneState: workspace.sceneState,
    };
  }
}
