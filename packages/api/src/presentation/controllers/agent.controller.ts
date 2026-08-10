import { Request, Response, NextFunction, Router } from 'express';
import { AgentService } from '../../application/services/agent.service';

export function createAgentRouter(service: AgentService): Router {
  const router = Router();

  // POST /ai/diagram-to-code/generate
  router.post('/diagram-to-code/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.generateDiagramToCode(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /ai/text-to-diagram/chat-streaming
  router.post('/text-to-diagram/chat-streaming', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use x-user-id from Kong for tracking if available, otherwise a fallback or ip
      const senderId = (req.headers['x-user-id'] as string) || req.ip || 'anonymous';
      const workspaceId = req.body.workspaceId; // If provided in payload
      
      await service.streamTextToDiagramChat(req.body.messages || [], res, senderId, workspaceId);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
