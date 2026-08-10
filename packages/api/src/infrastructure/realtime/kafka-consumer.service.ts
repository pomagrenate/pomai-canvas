import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

import { WorkspaceService } from '../../application/services/workspace.service';
import { RealtimeEvent } from '../../domain/ports/realtime.port';
import { ElementUpdateDto, CollaboratorEventDto } from '../../application/dtos/workspace.dto';

/**
 * KafkaConsumerService — Inbound event handler
 *
 * Subscribes to topic `realtime-outgoing-events` (the topic the realtime-hub
 * publishes to when clients send WebSocket messages).
 *
 * REPLACES the Webhook approach entirely. This is the single inbound channel
 * from the realtime-hub to this backend.
 *
 * EVENT ROUTING (by event_type):
 *   whiteboard:element_update     → WorkspaceService.handleElementUpdate()
 *   whiteboard:collaborator_joined → WorkspaceService.handleCollaboratorJoined()
 *   whiteboard:collaborator_left   → WorkspaceService.handleCollaboratorLeft()
 *
 * Unknown event types are logged and skipped — forward compatibility.
 */
export class KafkaConsumerService {
  private consumer: Consumer;

  constructor(
    private readonly kafka: Kafka,
    private readonly consumerTopic: string,
    private readonly groupId: string,
    private readonly workspaceService: WorkspaceService,
  ) {
    this.consumer = kafka.consumer({ groupId });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: this.consumerTopic,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    console.log(`[KafkaConsumer] Subscribed to "${this.consumerTopic}" as group "${this.groupId}"`);
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async handleMessage({ message }: EachMessagePayload): Promise<void> {
    if (!message.value) return;

    let event: RealtimeEvent;
    try {
      event = JSON.parse(message.value.toString()) as RealtimeEvent;
    } catch (err) {
      console.error('[KafkaConsumer] Failed to parse message:', err);
      return;
    }

    try {
      switch (event.event_type) {
        case 'whiteboard:element_update': {
          const payload = event.payload as {
            patch: ElementUpdateDto['patch'];
            clientVersion: number;
          };
          const dto: ElementUpdateDto = {
            workspaceId: event.target_id,
            senderId: event.sender_id,
            clientVersion: payload.clientVersion,
            patch: payload.patch,
          };
          await this.workspaceService.handleElementUpdate(dto);
          break;
        }

        case 'whiteboard:collaborator_joined': {
          const dto: CollaboratorEventDto = {
            workspaceId: event.target_id,
            userId: event.sender_id,
          };
          await this.workspaceService.handleCollaboratorJoined(dto);
          break;
        }

        case 'whiteboard:collaborator_left': {
          const dto: CollaboratorEventDto = {
            workspaceId: event.target_id,
            userId: event.sender_id,
          };
          await this.workspaceService.handleCollaboratorLeft(dto);
          break;
        }

        default:
          // Forward-compatible: ignore unknown events
          console.debug(`[KafkaConsumer] Ignoring unknown event_type: ${event.event_type}`);
      }
    } catch (err) {
      // Log but don't rethrow — let Kafka commit the offset to avoid poison-pill loops
      console.error(
        `[KafkaConsumer] Error handling event "${event.event_type}" for workspace "${event.target_id}":`,
        err,
      );
    }
  }
}
