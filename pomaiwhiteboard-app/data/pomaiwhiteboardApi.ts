/**
 * PomaiWhiteboard Backend API Client
 *
 * Integrates all 4 REST endpoints exposed by products/pomaiwhiteboard/backend
 * via Kong API Gateway (/api/v1/whiteboard).
 */

const API_BASE_URL =
  import.meta.env.VITE_APP_WHITEBOARD_API_URL || "/api/v1/whiteboard";

export interface WorkspaceResponse {
  id: string;
  name: string;
  ownerId: string | null;
  isTemporary: boolean;
  linkedWorkspaceId: string | null;
  collaborators: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSceneResponse extends WorkspaceResponse {
  sceneState: {
    elements: any[];
    appState: Record<string, any>;
  };
}

export interface ExportResponse {
  downloadUrl?: string;
  scene: {
    type: "excalidraw";
    version: number;
    source: string;
    elements: any[];
    appState: Record<string, any>;
    files: Record<string, any>;
  };
}

class PomaiWhiteboardApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * 1. POST /workspaces
   * Create a new temporary (guest) whiteboard room. No authentication required.
   */
  async createWorkspace(
    name: string = "Untitled Board",
    payload?: { elements?: any[]; appState?: any; files?: any }
  ): Promise<WorkspaceResponse> {
    const response = await fetch(`${this.baseUrl}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...payload }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create workspace (${response.status})`);
    }

    return response.json();
  }

  /**
   * 2. GET /workspaces/:id
   * Fetch workspace metadata + full scene state (elements and appState).
   */
  async getWorkspace(id: string): Promise<WorkspaceSceneResponse> {
    const response = await fetch(`${this.baseUrl}/workspaces/${id}`);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to get workspace (${response.status})`);
    }

    return response.json();
  }

  /**
   * 3. POST /workspaces/:id/claim
   * Claim a temporary guest workspace for an authenticated user.
   * Migrates storage from Redis (24h TTL) to PostgreSQL.
   */
  async claimWorkspace(
    id: string,
    params?: { linkedWorkspaceId?: string; authToken?: string; userId?: string },
  ): Promise<WorkspaceResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (params?.authToken) {
      headers["Authorization"] = `Bearer ${params.authToken}`;
    }
    if (params?.userId) {
      headers["X-User-Id"] = params.userId;
    }

    const response = await fetch(`${this.baseUrl}/workspaces/${id}/claim`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        linkedWorkspaceId: params?.linkedWorkspaceId,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to claim workspace (${response.status})`);
    }

    return response.json();
  }

  /**
   * 4. GET /workspaces/:id/export
   * Export workspace scene as .excalidraw format with MinIO presigned download URL.
   */
  async exportWorkspace(id: string): Promise<ExportResponse> {
    const response = await fetch(`${this.baseUrl}/workspaces/${id}/export`);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to export workspace (${response.status})`);
    }

    return response.json();
  }

  /**
   * 5. GET /workspaces
   * Fetch all claimed system workspaces owned by the user.
   */
  async getUserWorkspaces(userId?: string): Promise<WorkspaceResponse[]> {
    const headers: Record<string, string> = {};
    if (userId) {
      headers["X-User-Id"] = userId;
    }

    const response = await fetch(`${this.baseUrl}/workspaces`, {
      method: "GET",
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch user workspaces (${response.status})`);
    }

    return response.json();
  }

  /**
   * 6. DELETE /workspaces/:id
   * Delete a saved system workspace.
   */
  async deleteWorkspace(id: string, userId?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (userId) {
      headers["X-User-Id"] = userId;
    }

    const response = await fetch(`${this.baseUrl}/workspaces/${id}`, {
      method: "DELETE",
      headers,
      credentials: "include",
    });

    if (!response.ok && response.status !== 204) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete workspace (${response.status})`);
    }
  }
}

export const pomaiWhiteboardApi = new PomaiWhiteboardApiClient();

