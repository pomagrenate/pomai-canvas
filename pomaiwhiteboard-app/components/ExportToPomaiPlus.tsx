import React from "react";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { IconButton } from "@excalidraw/excalidraw/components/IconButton";
import { getFrame } from "@excalidraw/common";
import { useI18n } from "@excalidraw/excalidraw/i18n";

import type {
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { pomaiWhiteboardApi } from "../data/pomaiwhiteboardApi";
import { useAuth } from "../context/AuthContext";

export const checkAuthStatus = async (): Promise<{ isAuthenticated: boolean; userId?: string }> => {
  try {
    const authUrl = import.meta.env.VITE_APP_AUTH_URL || "http://localhost:8000/api/auth/me";
    const res = await fetch(authUrl, {
      method: "GET",
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.user?.id) {
        return { isAuthenticated: true, userId: data.user.id };
      }
    }
  } catch (e) {
    console.error("Auth check error:", e);
  }

  const token = localStorage.getItem("token") || localStorage.getItem("auth_token");
  const userStr = localStorage.getItem("user");
  if (token || userStr) {
    try {
      const user = userStr ? JSON.parse(userStr) : null;
      return { isAuthenticated: true, userId: user?.id };
    } catch {}
  }
  return { isAuthenticated: false };
};

export const exportToPomaiWorkspace = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  name: string,
  userId?: string,
) => {
  const auth = await checkAuthStatus();
  if (!auth.isAuthenticated) {
    window.open("http://localhost:4173/login", "_blank");
    return;
  }

  const activeUserId = userId || auth.userId;
  const workspaceName = name || "Untitled Board";
  const ws = await pomaiWhiteboardApi.createWorkspace(workspaceName, {
    elements,
    appState,
    files,
  });
  await pomaiWhiteboardApi.claimWorkspace(ws.id, { userId: activeUserId });
  await pomaiWhiteboardApi.exportWorkspace(ws.id);
};

// Retain alias export for backward compatibility
export const exportToExcalidrawPlus = exportToPomaiWorkspace;

export const ExportToExcalidrawPlus: React.FC<{
  elements: readonly NonDeletedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  name: string;
  onError: (error: Error) => void;
  onSuccess: () => void;
}> = ({ elements, appState, files, name, onError, onSuccess }) => {
  const { t } = useI18n();
  const authContext = useAuth();

  return (
    <Card color="primary">
      <div
        className="Card-icon"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2.8rem",
          height: "2.8rem",
          background: "transparent",
        }}
      >
        <img
          src="/favicon-96x96.png"
          alt="Pomai Whiteboard"
          style={{ width: "2.5rem", height: "2.5rem", objectFit: "contain" }}
        />
      </div>
      <h2>Pomai Whiteboard</h2>
      <div className="Card-details">
        {t("exportDialog.excalidrawplus_description")}
      </div>
      <IconButton
        className="Card-button"
        type="button"
        title={t("exportDialog.excalidrawplus_button")}
        aria-label={t("exportDialog.excalidrawplus_button")}
        showAriaLabel={true}
        onClick={async () => {
          try {
            trackEvent("export", "pomaiwhiteboard", `ui (${getFrame()})`);
            
            // Check AuthContext state as well as checkAuthStatus
            const isAuthed = authContext.isAuthenticated || (await checkAuthStatus()).isAuthenticated;
            if (!isAuthed) {
              window.open("http://localhost:4173/login", "_blank");
              onSuccess();
              return;
            }

            await exportToPomaiWorkspace(
              elements,
              appState,
              files,
              name,
              authContext.user?.id,
            );
            onSuccess();
          } catch (error: any) {
            console.error(error);
            if (error.name !== "AbortError") {
              onError(new Error(t("exportDialog.excalidrawplus_exportError")));
            }
          }
        }}
      />
    </Card>
  );
};
