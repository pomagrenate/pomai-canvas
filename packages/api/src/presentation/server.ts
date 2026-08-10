import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { Kafka } from 'kafkajs';

// Domain ports & infrastructure implementations
import { RedisWorkspaceRepository } from '../infrastructure/persistence/redis-workspace.repo';
import { PostgresWorkspaceRepository } from '../infrastructure/persistence/postgres-workspace.repo';
import { CompositeWorkspaceRepository } from '../infrastructure/persistence/composite-workspace.repo';
import { KafkaRealtimeAdapter } from '../infrastructure/realtime/kafka-realtime.adapter';
import { KafkaConsumerService } from '../infrastructure/realtime/kafka-consumer.service';

// Application layer
import { WorkspaceService } from '../application/services/workspace.service';
import { AgentService } from '../application/services/agent.service';

// Presentation layer
import {
  createWorkspaceRouter,
  domainErrorHandler,
} from './controllers/workspace.controller';
import { createAgentRouter } from './controllers/agent.controller';

import { Client as MinioClient } from 'minio';
import { MinioFileService } from '../infrastructure/storage/minio-file.service';

// ---------------------------------------------------------------------------
// Config from environment (see .env.example)
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? '3010', 10);
const DATABASE_URL = process.env.DATABASE_URL!;
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
const KAFKA_CONSUMER_TOPIC = process.env.KAFKA_CONSUMER_TOPIC ?? 'realtime-outgoing-events';
const KAFKA_PRODUCER_TOPIC = process.env.KAFKA_PRODUCER_TOPIC ?? 'realtime-incoming-events';
const KAFKA_CONSUMER_GROUP = process.env.KAFKA_CONSUMER_GROUP ?? 'pomaiwhiteboard-state-manager';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'minio:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? 'minioadminpassword';
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'pomai-storage';

async function bootstrap(): Promise<void> {
  // ---------------------------------------------------------------------------
  // Infrastructure: Database & Storage connections
  // ---------------------------------------------------------------------------
  const pgPool = new Pool({ connectionString: DATABASE_URL });
  const redis = new Redis(REDIS_URL, { lazyConnect: true });

  await redis.connect();
  console.log('[Bootstrap] Redis connected');

  await pgPool.query('SELECT 1'); // health check
  console.log('[Bootstrap] Postgres connected');

  // MinIO storage client
  const [minioHost, minioPortStr] = MINIO_ENDPOINT.split(':');
  const minioClient = new MinioClient({
    endPoint: minioHost,
    port: parseInt(minioPortStr || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
  });

  const minioFileService = new MinioFileService(minioClient, MINIO_BUCKET);
  await minioFileService.ensureBucket().catch((err) => {
    console.warn('[Bootstrap] MinIO bucket check skipped/warned:', err.message);
  });

  // ---------------------------------------------------------------------------
  // Infrastructure: Kafka
  // ---------------------------------------------------------------------------
  const kafka = new Kafka({
    clientId: 'pomaiwhiteboard-backend',
    brokers: KAFKA_BROKERS,
    retry: { initialRetryTime: 300, retries: 8 },
  });

  const kafkaRealtimeAdapter = new KafkaRealtimeAdapter(kafka, KAFKA_PRODUCER_TOPIC);
  await kafkaRealtimeAdapter.connect();
  console.log(`[Bootstrap] Kafka producer connected → topic: ${KAFKA_PRODUCER_TOPIC}`);

  // ---------------------------------------------------------------------------
  // Infrastructure: Repositories (DI wiring)
  // ---------------------------------------------------------------------------
  const redisRepo = new RedisWorkspaceRepository(redis);
  const postgresRepo = new PostgresWorkspaceRepository(pgPool);
  const compositeRepo = new CompositeWorkspaceRepository(redisRepo, postgresRepo);

  // ---------------------------------------------------------------------------
  // Application Layer: WorkspaceService (injected with ports & storage)
  // ---------------------------------------------------------------------------
  const workspaceService = new WorkspaceService(
    compositeRepo,
    kafkaRealtimeAdapter,
    minioFileService,
  );


  // ---------------------------------------------------------------------------
  // Infrastructure: Kafka Consumer (inbound events from realtime-hub)
  // ---------------------------------------------------------------------------
  const kafkaConsumer = new KafkaConsumerService(
    kafka,
    KAFKA_CONSUMER_TOPIC,
    KAFKA_CONSUMER_GROUP,
    workspaceService,
  );
  await kafkaConsumer.start();
  console.log(`[Bootstrap] Kafka consumer listening → topic: ${KAFKA_CONSUMER_TOPIC}`);

  // ---------------------------------------------------------------------------
  // Presentation: Express HTTP Server
  // ---------------------------------------------------------------------------
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check (Kong uses this for upstream health probing)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'pomaiwhiteboard-backend' });
  });

  // Workspace REST API
  // Registered as /workspaces — Kong strips /api/v1/whiteboard prefix
  app.use('/workspaces', createWorkspaceRouter(workspaceService));

  // AI REST API
  const agentService = new AgentService(kafkaRealtimeAdapter);
  app.use('/ai', createAgentRouter(agentService));

  // Domain error → HTTP status mapping (must be last)
  app.use(domainErrorHandler);

  // Serve frontend static files
  const frontendPath = process.env.FRONTEND_STATIC_PATH || '/app/public';
  app.use(express.static(frontendPath));

  // Fallback for SPA routing
  app.get('*', (req, res, next) => {
    // Only serve index.html for non-API routes
    if (req.path.startsWith('/workspaces') || req.path.startsWith('/ai') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  const server = app.listen(PORT, () => {
    console.log(`[Bootstrap] pomaiwhiteboard-backend running on port ${PORT}`);
  });

  // ---------------------------------------------------------------------------
  // Graceful Shutdown
  // ---------------------------------------------------------------------------
  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Received ${signal}. Closing gracefully...`);

    server.close(async () => {
      await kafkaConsumer.stop();
      await kafkaRealtimeAdapter.disconnect();
      await pgPool.end();
      redis.disconnect();
      console.log('[Shutdown] All connections closed. Exiting.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal error during startup:', err);
  process.exit(1);
});
