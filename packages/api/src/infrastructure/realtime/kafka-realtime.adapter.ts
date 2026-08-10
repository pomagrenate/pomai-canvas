import { Kafka, Producer, Partitioners, CompressionTypes } from 'kafkajs';

import { IRealtimePort, RealtimeEvent } from '../../domain/ports/realtime.port';

/**
 * KafkaRealtimeAdapter — Infrastructure implementation of IRealtimePort
 *
 * Publishes validated backend state-change events to Kafka topic
 * `realtime-incoming-events`. The realtime-hub (Go) consumes this topic
 * and routes messages to connected WebSocket clients based on target_type:
 *   - ROOM      → hub.SendToRoom(workspaceId, payload)
 *   - USER      → hub.SendToUser(userId, payload)
 *   - BROADCAST → hub.Broadcast(payload)
 *
 * Message key = target_id (workspaceId or userId) for partition locality —
 * ensures all events for the same room are processed in order by a single
 * hub consumer partition.
 */
export class KafkaRealtimeAdapter implements IRealtimePort {
  private producer: Producer;
  private readonly topic: string;
  private connected = false;

  constructor(
    private readonly kafka: Kafka,
    producerTopic: string,
  ) {
    this.topic = producerTopic;
    this.producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      retry: {
        initialRetryTime: 100,
        retries: 5,
      },
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }

  async publish(event: RealtimeEvent): Promise<void> {
    if (!this.connected) {
      throw new Error('KafkaRealtimeAdapter: producer not connected. Call connect() first.');
    }

    const messageValue = JSON.stringify(event);

    await this.producer.send({
      topic: this.topic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          // Partition by target_id for ordered delivery per room/user
          key: event.target_id,
          value: messageValue,
          timestamp: String(Date.now()),
        },
      ],
    });
  }
}
