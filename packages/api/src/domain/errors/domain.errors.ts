/**
 * Domain Errors
 *
 * Typed exceptions for the Workspace domain. These are pure domain concerns —
 * infrastructure and presentation layers catch these and map them to the
 * appropriate HTTP status codes or Kafka error events.
 */

export class DomainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a caller attempts to claim a workspace that already has an owner.
 */
export class WorkspaceAlreadyClaimedError extends DomainError {
  constructor(workspaceId: string) {
    super(
      `Workspace "${workspaceId}" has already been claimed and cannot be claimed again.`,
      'WORKSPACE_ALREADY_CLAIMED',
    );
    this.name = 'WorkspaceAlreadyClaimedError';
  }
}

/**
 * Thrown when a workspace ID is looked up but no matching record exists
 * in either Redis (temporary) or Postgres (persistent).
 */
export class WorkspaceNotFoundError extends DomainError {
  constructor(workspaceId: string) {
    super(
      `Workspace "${workspaceId}" was not found.`,
      'WORKSPACE_NOT_FOUND',
    );
    this.name = 'WorkspaceNotFoundError';
  }
}

/**
 * Thrown when a scene update payload fails structural validation.
 */
export class InvalidSceneUpdateError extends DomainError {
  constructor(reason: string) {
    super(
      `Scene update rejected: ${reason}`,
      'INVALID_SCENE_UPDATE',
    );
    this.name = 'InvalidSceneUpdateError';
  }
}

/**
 * Thrown when a user who is not an owner or collaborator attempts
 * a write operation on a claimed workspace.
 */
export class UnauthorizedWorkspaceAccessError extends DomainError {
  constructor(workspaceId: string, userId: string) {
    super(
      `User "${userId}" is not authorized to modify workspace "${workspaceId}".`,
      'UNAUTHORIZED_WORKSPACE_ACCESS',
    );
    this.name = 'UnauthorizedWorkspaceAccessError';
  }
}
