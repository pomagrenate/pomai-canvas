import React, { useEffect, useState } from "react";
import { Dialog } from "../../packages/pomaiwhiteboard/components/Dialog";
import { pomaiWhiteboardApi, WorkspaceResponse } from "../data/pomaiwhiteboardApi";
import { useAuth } from "../context/AuthContext";


interface SavedWhiteboardsModalProps {
  onClose: () => void;
  onSelectBoard: (boardId: string) => void;
}

export const SavedWhiteboardsModal: React.FC<SavedWhiteboardsModalProps> = ({
  onClose,
  onSelectBoard,
}) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pomaiWhiteboardApi.getUserWorkspaces(user?.id);
      setWorkspaces(data);
    } catch (err: any) {
      console.error("Failed to load user whiteboards:", err);
      setError(err.message || "Failed to load saved whiteboards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    try {
      await pomaiWhiteboardApi.deleteWorkspace(id, user?.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete whiteboard");
    }
  };

  const handleExport = async (id: string) => {
    try {
      const result = await pomaiWhiteboardApi.exportWorkspace(id);
      if (result.downloadUrl) {
        window.open(result.downloadUrl, "_blank");
      } else {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(result.scene, null, 2)
        )}`;
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", jsonString);
        downloadAnchor.setAttribute("download", `whiteboard-${id}.excalidraw`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (err: any) {
      alert(err.message || "Failed to export whiteboard snapshot");
    }
  };

  return (
    <Dialog onCloseRequest={onClose} title="My Saved System Whiteboards">
      <div style={{ padding: "1rem", minWidth: "420px", maxWidth: "680px" }}>
        {loading && <p>Loading your saved whiteboards...</p>}

        {error && (
          <div style={{ color: "#e53e3e", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {!loading && !error && workspaces.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <p style={{ fontSize: "1.1rem", color: "#666" }}>
              No system whiteboards saved yet.
            </p>
            <p style={{ fontSize: "0.9rem", color: "#888" }}>
              Click <strong>Save</strong> while signed in to store your canvas permanently in the system.
            </p>
          </div>
        )}

        {!loading && workspaces.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "60vh", overflowY: "auto" }}>
            {workspaces.map((board) => (
              <div
                key={board.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1.1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--sidebar-border-color, #e2e8f0)",
                  backgroundColor: "var(--island-bg-color, #ffffff)",
                }}
              >
                <div>
                  <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 600 }}>
                    {board.name || "Untitled Board"}
                  </h4>
                  <span style={{ fontSize: "0.8rem", color: "#718096" }}>
                    Last saved: {new Date(board.updatedAt).toLocaleDateString()} at{" "}
                    {new Date(board.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="DialogUtils__button"
                    style={{
                      padding: "0.4rem 0.8rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      backgroundColor: "var(--color-primary, #6965db)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      onSelectBoard(board.id);
                      onClose();
                    }}
                  >
                    Open
                  </button>

                  <button
                    className="DialogUtils__button"
                    style={{
                      padding: "0.4rem 0.8rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e0",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => handleExport(board.id)}
                    title="Export .excalidraw from MinIO"
                  >
                    Export
                  </button>

                  <button
                    className="DialogUtils__button"
                    style={{
                      padding: "0.4rem 0.8rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "#fff5f5",
                      color: "#e53e3e",
                      cursor: "pointer",
                    }}
                    onClick={() => handleDelete(board.id, board.name)}
                    title="Delete saved board"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};
