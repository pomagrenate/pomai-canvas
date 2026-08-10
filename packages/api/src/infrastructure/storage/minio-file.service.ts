import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

/**
 * MinIO File Storage Service — `.excalidraw` File Persistence
 *
 * ARCHITECTURE DECISION (data-hub analysis):
 *   `infrastructure/data-hub` uses MinIO exclusively as a Parquet/Lakehouse
 *   store for event analytics. It uses the bucket named "lakehouse" and writes
 *   batched Parquet files from Kafka events. It is NOT designed for user-facing
 *   file uploads — it has no HTTP API, no presigned URLs, and no per-file CRUD.
 *
 *   Therefore, `pomaiwhiteboard` uses MinIO DIRECTLY via its own dedicated
 *   bucket: "pomaiwhiteboard". This keeps whiteboard file storage completely
 *   isolated from the data-hub analytics pipeline.
 *
 * WHAT IS STORED HERE:
 *   - `.excalidraw` JSON snapshots: exported scene files users can download/share
 *   - Object key pattern: `scenes/{workspaceId}/{version}.excalidraw`
 *   - Thumbnail previews (future): `thumbnails/{workspaceId}/latest.png`
 *
 * WHAT IS NOT STORED HERE:
 *   - Active scene state → stays in Redis (temporary) or Postgres (claimed)
 *   - This is the "export" / "download" / "snapshot" layer only
 */
export class MinioFileService {
  private readonly bucket: string;

  constructor(
    private readonly client: MinioClient,
    bucket: string,
  ) {
    this.bucket = bucket;
  }

  /**
   * Ensure the dedicated whiteboard bucket exists.
   * Called once during server bootstrap.
   */
  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, '');
      console.log(`[MinioFileService] Created bucket: ${this.bucket}`);
    }
  }

  /**
   * Save a .excalidraw scene snapshot.
   *
   * @param workspaceId - The whiteboard workspace UUID
   * @param version     - Scene version number (for versioned history)
   * @param scene       - The full SceneState JSON payload
   * @returns The MinIO object key (for constructing presigned download URLs)
   */
  async saveScene(
    workspaceId: string,
    version: number,
    scene: object,
  ): Promise<string> {
    const objectKey = `scenes/${workspaceId}/${version}.excalidraw`;
    const content = JSON.stringify(scene, null, 2);
    const buffer = Buffer.from(content, 'utf-8');
    const stream = Readable.from(buffer);

    await this.client.putObject(
      this.bucket,
      objectKey,
      stream,
      buffer.length,
      { 'Content-Type': 'application/json' },
    );

    return objectKey;
  }

  /**
   * Generate a presigned download URL for a .excalidraw file.
   * URL expires in 1 hour — safe for browser-based downloads.
   */
  async getPresignedDownloadUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }

  /**
   * Get the latest snapshot for a workspace.
   * Returns the parsed SceneState or null if not found.
   */
  async getLatestScene(workspaceId: string, version: number): Promise<object | null> {
    const objectKey = `scenes/${workspaceId}/${version}.excalidraw`;
    try {
      const stream = await this.client.getObject(this.bucket, objectKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    } catch (err: unknown) {
      const minioErr = err as { code?: string };
      if (minioErr?.code === 'NoSuchKey') return null;
      throw err;
    }
  }

  /**
   * List all snapshots for a workspace (version history).
   */
  async listSnapshots(workspaceId: string): Promise<string[]> {
    const prefix = `scenes/${workspaceId}/`;
    const objects: string[] = [];

    const stream = this.client.listObjectsV2(this.bucket, prefix, true);
    for await (const obj of stream) {
      if (obj.name) objects.push(obj.name);
    }

    return objects.sort();
  }

  /**
   * Delete all snapshots for a workspace.
   * Used when a workspace is permanently deleted.
   */
  async deleteWorkspaceSnapshots(workspaceId: string): Promise<void> {
    const keys = await this.listSnapshots(workspaceId);
    for (const key of keys) {
      await this.client.removeObject(this.bucket, key);
    }
  }
}
