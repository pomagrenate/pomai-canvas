import {
  EXPORT_DATA_TYPES,
  getExportSource,
  MIME_TYPES,
  VERSIONS,
} from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { MaybePromise } from "@excalidraw/common/utility-types";

import { cleanAppStateForExport, clearAppStateForDatabase } from "../appState";

import { isImageFileHandle, loadFromBlob } from "./blob";
import { fileOpen, fileSave } from "./filesystem";

import type { AppState, BinaryFiles, LibraryItems } from "../types";
import type {
  ExportedDataState,
  ImportedDataState,
  ExportedLibraryData,
  ImportedLibraryData,
} from "./types";

export type JSONExportData = {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

/**
 * Strips out files which are only referenced by deleted elements
 */
const filterOutDeletedFiles = (
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
) => {
  const nextFiles: BinaryFiles = {};
  for (const element of elements) {
    if (
      !element.isDeleted &&
      "fileId" in element &&
      element.fileId &&
      files[element.fileId]
    ) {
      nextFiles[element.fileId] = files[element.fileId];
    }
  }
  return nextFiles;
};

export const serializeAsJSON = (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  type: "local" | "database",
): string => {
  const data: ExportedDataState = {
    type: EXPORT_DATA_TYPES.pomaiwhiteboard,
    version: VERSIONS.excalidraw,
    source: getExportSource(),
    elements,
    appState:
      type === "local"
        ? cleanAppStateForExport(appState)
        : clearAppStateForDatabase(appState),
    files:
      type === "local"
        ? filterOutDeletedFiles(elements, files)
        : // will be stripped from JSON
          undefined,
  };

  return JSON.stringify(data, null, 2);
};

export const saveAsJSON = async ({
  data,
  filename,
  fileHandle,
}: {
  data: MaybePromise<JSONExportData>;
  filename: string;
  fileHandle: AppState["fileHandle"];
}) => {
  const blob = Promise.resolve(data).then(({ elements, appState, files }) => {
    const serialized = serializeAsJSON(elements, appState, files, "local");
    return new Blob([serialized], {
      type: MIME_TYPES.pomaiwhiteboard,
    });
  });

  const savedFileHandle = await fileSave(
    blob,
    [
      {
        fileName: `${filename}.pomaiwhiteboard`,
        description: "Pomai Whiteboard file (.pomaiwhiteboard)",
        extensions: [".pomaiwhiteboard"],
        mimeTypes: [MIME_TYPES.pomaiwhiteboard],
      },
      {
        fileName: `${filename}.excalidraw`,
        description: "Excalidraw file (.excalidraw)",
        extensions: [".excalidraw"],
        mimeTypes: [MIME_TYPES.excalidraw],
      },
    ],
    isImageFileHandle(fileHandle) ? null : fileHandle,
  );
  return { fileHandle: savedFileHandle };
};

export const loadFromJSON = async (
  localAppState: AppState,
  localElements: readonly ExcalidrawElement[] | null,
) => {
  const file = await fileOpen({
    description: "Pomai Whiteboard files (.pomaiwhiteboard, .excalidraw)",
    extensions: ["pomaiwhiteboard", "excalidraw", "json"],
  });
  return loadFromBlob(file, localAppState, localElements, file.handle);
};

export const isValidExcalidrawData = (data?: {
  type?: any;
  elements?: any;
  appState?: any;
}): data is ImportedDataState => {
  return (
    (data?.type === EXPORT_DATA_TYPES.pomaiwhiteboard ||
      data?.type === EXPORT_DATA_TYPES.excalidraw ||
      data?.type === "pomaiwhiteboard" ||
      data?.type === "excalidraw") &&
    (!data.elements ||
      (Array.isArray(data.elements) &&
        (!data.appState || typeof data.appState === "object")))
  );
};

export const isValidLibrary = (json: any): json is ImportedLibraryData => {
  return (
    typeof json === "object" &&
    json &&
    (json.type === EXPORT_DATA_TYPES.pomaiLibrary ||
      json.type === EXPORT_DATA_TYPES.pomaiwhiteboardLibrary ||
      json.type === EXPORT_DATA_TYPES.excalidrawLibrary ||
      json.type === "pomailib" ||
      json.type === "pomaiwhiteboardlib" ||
      json.type === "excalidrawlib") &&
    (json.version === 1 || json.version === 2)
  );
};

export const serializeLibraryAsJSON = (libraryItems: LibraryItems) => {
  const data: ExportedLibraryData = {
    type: EXPORT_DATA_TYPES.pomaiwhiteboardLibrary,
    version: VERSIONS.excalidrawLibrary,
    source: getExportSource(),
    libraryItems,
  };
  return JSON.stringify(data, null, 2);
};

export const saveLibraryAsJSON = async (libraryItems: LibraryItems) => {
  const serialized = serializeLibraryAsJSON(libraryItems);
  await fileSave(
    new Blob([serialized], {
      type: MIME_TYPES.pomaiwhiteboardlib,
    }),
    [
      {
        fileName: "library.pomaiwhiteboardlib",
        description: "Pomai Whiteboard library file (.pomaiwhiteboardlib)",
        extensions: [".pomaiwhiteboardlib"],
        mimeTypes: [MIME_TYPES.pomaiwhiteboardlib],
      },
      {
        fileName: "library.excalidrawlib",
        description: "Excalidraw library file (.excalidrawlib)",
        extensions: [".excalidrawlib"],
        mimeTypes: [MIME_TYPES.excalidrawlib],
      },
      {
        fileName: "library.pomailib",
        description: "Pomai library file (.pomailib)",
        extensions: [".pomailib"],
        mimeTypes: [MIME_TYPES.pomailib],
      },
    ],
  );
};
