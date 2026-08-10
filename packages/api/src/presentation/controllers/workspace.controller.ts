import { Request, Response, NextFunction, Router } from 'express';
import { WorkspaceService } from '../../application/services/workspace.service';
import { ClaimWorkspaceDto, CreateWorkspaceDto } from '../../application/dtos/workspace.dto';
import {
  WorkspaceNotFoundError,
  WorkspaceAlreadyClaimedError,
  UnauthorizedWorkspaceAccessError,
  DomainError,
} from '../../domain/errors/domain.errors';

/**
 * WorkspaceController — REST API
 *
 * Routes exposed via Kong at /api/v1/whiteboard/workspaces
 *
 * AUTHENTICATION MODEL (PLG Freemium):
 *   GET  /workspaces/:id          → Public. No auth needed. Share-by-link.
 *   POST /workspaces              → Public. Guests create boards freely.
 *   POST /workspaces/:id/claim    → REQUIRES auth. JWT from core/workspace/backend.
 *
 * The JWT check for /claim reads the `X-User-Id` header, which Kong injects
 * after validating the JWT issued by core/workspace auth service (same secret).
 * This avoids re-implementing JWT verification here.
 */

export function createWorkspaceRouter(service: WorkspaceService): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /workspaces
  // Fetch all claimed workspaces owned by the authenticated user.
  // -------------------------------------------------------------------------
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string | undefined;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required to list workspaces.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const workspaces = await service.getUserWorkspaces(userId);
      res.json(workspaces);
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // POST /workspaces
  // Create a new temporary (guest) whiteboard. No auth required.
  // -------------------------------------------------------------------------
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto: CreateWorkspaceDto = {
        name: (req.body.name as string) || 'Untitled Board',
        elements: req.body.elements,
        appState: req.body.appState,
        files: req.body.files,
      };
      const workspace = await service.createWorkspace(dto);
      res.status(201).json(workspace);
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // GET /workspaces/:id
  // Fetch workspace metadata + full scene state. Public — share-by-link.
  // -------------------------------------------------------------------------
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await service.getWorkspace(req.params.id);
      res.json(workspace);
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /workspaces/:id
  // Delete a workspace owned by the authenticated user.
  // -------------------------------------------------------------------------
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string | undefined;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required to delete a workspace.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      await service.deleteWorkspace(req.params.id, userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });


  // -------------------------------------------------------------------------
  // POST /workspaces/:id/claim
  // Claim a temporary workspace. REQUIRES authenticated user.
  //
  // Authentication:
  //   Kong validates the JWT and injects `X-User-Id` header.
  //   We read userId from this header — no JWT parsing needed here.
  //
  // Body (optional):
  //   { linkedWorkspaceId: string } — links this board to an org workspace
  //   in core/workspace/backend for team access.
  // -------------------------------------------------------------------------
  router.post('/:id/claim', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Kong injects this header after JWT validation
      const userId = req.headers['x-user-id'] as string | undefined;

      if (!userId) {
        res.status(401).json({
          error: 'Authentication required to claim a workspace.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const dto: ClaimWorkspaceDto = {
        workspaceId: req.params.id,
        userId,
        linkedWorkspaceId: req.body.linkedWorkspaceId as string | undefined,
      };

      const workspace = await service.claimWorkspace(dto);
      res.json(workspace);
    } catch (err) {
      next(err);
    }
  });

  // -------------------------------------------------------------------------
  // GET /workspaces/:id/export
  // Export workspace scene as .excalidraw format with optional MinIO download URL.
  // -------------------------------------------------------------------------
  router.get('/:id/export', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.exportExcalidrawFile(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}


// ---------------------------------------------------------------------------
// Global Error Handler Middleware
//
// Maps domain errors to HTTP status codes.
// Must be registered LAST in the Express app (after all routes).
// ---------------------------------------------------------------------------
export function domainErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof WorkspaceNotFoundError) {
    res.status(404).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof WorkspaceAlreadyClaimedError) {
    res.status(409).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof UnauthorizedWorkspaceAccessError) {
    res.status(403).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof DomainError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }

  // Unhandled errors
  console.error('[UnhandledError]', err);
  res.status(500).json({ error: 'Internal server error' });
}
