/**
 * IRealtimePort — Domain Port for Kafka-based communication with realtime-hub
 *
 * The backend NEVER opens WebSocket connections directly. All client
 * communication flows through the Go `infrastructure/realtime-hub` service.
 *
 * KAFKA TOPOLOGY:
 *   INBOUND  (hub → backend): Topic `realtime-outgoing-events`
 *             The hub publishes WebSocket client messages here.
 *             The KafkaConsumerService (infrastructure) reads these.
 *
 *   OUTBOUND (backend → hub): Topic `realtime-incoming-events`
 *             The backend publishes validated state changes here.
 *             The hub consumes these and pushes to connected WebSocket clients.
 *             This interface governs OUTBOUND only.
 *
 * EventEnvelope mirrors the realtime-hub Go struct:
 *   pkg/models/EventEnvelope in infrastructure/realtime-hub
 * Keep this TypeScript interface in sync with that Go struct.
 */

export type RealtimeTargetType = 'USER' | 'ROOM' | 'BROADCAST';

/**
 * Matches infrastructure/realtime-hub/pkg/models/EventEnvelope exactly.
 * The hub routes delivery based on target_type + target_id.
 */
export interface RealtimeEvent {
  event_type: string;       // e.g. "whiteboard:scene_updated", "whiteboard:workspace_claimed"
  target_type: RealtimeTargetType;
  target_id: string;        // workspaceId for ROOM, userId for USER
  sender_id: string;        // sessionId or userId of the originating client
  payload: unknown;         // JSON-serializable data
  timestamp: string;        // ISO 8601
}

/**
 * Strongly-typed payloads for each event type.
 * These are the `payload` field of RealtimeEvent — typed for type-safe publishing.
 */
export interface SceneUpdatedPayload {
  workspaceId: string;
  version: number;
  patch: {
    elements?: unknown[];
    appState?: Record<string, unknown>;
  };
}

export interface WorkspaceClaimedPayload {
  workspaceId: string;
  ownerId: string;
  linkedWorkspaceId: string | null;
  isTemporary: false;
}

export interface CollaboratorJoinedPayload {
  workspaceId: string;
  userId: string;
}

export interface CollaboratorLeftPayload {
  workspaceId: string;
  userId: string;
}

/**
 * IRealtimePort — the outbound publishing interface.
 *
 * Implemented by KafkaRealtimeAdapter in the infrastructure layer.
 * The service layer depends only on this interface for DI.
 */
export interface IRealtimePort {
  /**
   * Publish a validated event to the realtime-hub via Kafka.
   * The hub will route it to the correct WebSocket clients based on target_type.
   */
  publish(event: RealtimeEvent): Promise<void>;
}
