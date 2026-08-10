import { IRealtimePort } from '../../domain/ports/realtime.port';


export class AgentService {
  constructor(private readonly realtimePort: IRealtimePort) {}

  private readonly AI_HUB_URL = process.env.AI_HUB_URL || 'http://ai-hub:3010';

  async generateDiagramToCode(payload: any): Promise<{ html: string }> {
    const response = await fetch(`${this.AI_HUB_URL}/api/v1/diagram-to-code/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AI Hub returned ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<{ html: string }>;
  }

  async streamTextToDiagramChat(messages: any[], res: any, senderId: string, workspaceId?: string): Promise<void> {
    // 1. Emit Kafka event for data-hub ingestion
    try {
      await this.realtimePort.publish({
        event_type: 'whiteboard:chat_message',
        target_type: 'USER',
        target_id: workspaceId || senderId,
        sender_id: senderId,
        payload: { messages },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[AgentService] Failed to publish chat to Kafka:', err);
    }

    // 2. Stream from AI Hub to the client
    const response = await fetch(`${this.AI_HUB_URL}/api/v1/text-to-diagram/chat-streaming`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      res.status(response.status).send(await response.text());
      return;
    }

    // Set headers for chunked streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (response.body) {
      const { Readable } = require('stream');
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  }
}
