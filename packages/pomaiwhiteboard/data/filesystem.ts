import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  supported as nativeFileSystemSupported,
} from "browser-fs-access";

import { MIME_TYPES } from "@excalidraw/common";

import { normalizeFile } from "./blob";

type FILE_EXTENSION = Exclude<keyof typeof MIME_TYPES, "binary">;

export const fileOpen = async <M extends boolean | undefined = false>(opts: {
  extensions?: FILE_EXTENSION[];
  description: string;
  multiple?: M;
}): Promise<M extends false | undefined ? File : File[]> => {
  // an unsafe TS hack, alas not much we can do AFAIK
  type RetType = M extends false | undefined ? File : File[];

  const mimeTypes = opts.extensions?.reduce((mimeTypes, type) => {
    mimeTypes.push(MIME_TYPES[type]);

    return mimeTypes;
  }, [] as string[]);

  const extensions = opts.extensions?.reduce((acc, ext) => {
    if (ext === "jpg") {
      return acc.concat(".jpg", ".jpeg");
    }
    return acc.concat(`.${ext}`);
  }, [] as string[]);

  const files = await _fileOpen({
    description: opts.description,
    extensions,
    mimeTypes,
    multiple: opts.multiple ?? false,
  });

  if (Array.isArray(files)) {
    return (await Promise.all(
      files.map((file) => normalizeFile(file)),
    )) as RetType;
  }
  return (await normalizeFile(files)) as RetType;
};

export const fileSave = (
  blob: Blob | Promise<Blob>,
  opts:
    | {
        /** supply without the extension */
        name: string;
        /** file extension */
        extension?: FILE_EXTENSION;
        extensions?: string[];
        mimeTypes?: string[];
        description?: string;
        /** existing FileSystemFileHandle */
        fileHandle?: FileSystemFileHandle | null;
      }
    | Array<{
        fileName: string;
        extensions: string[];
        mimeTypes?: string[];
        description: string;
      }>,
  fileHandle?: FileSystemFileHandle | null,
) => {
  if (Array.isArray(opts)) {
    return _fileSave(blob, opts as any, fileHandle ?? null, false);
  }

  const extension =
    opts.extension ??
    (opts.extensions?.[0]?.replace(/^\./, "") as FILE_EXTENSION);
  const extensions =
    opts.extensions ?? (opts.extension ? [`.${opts.extension}`] : []);

  return _fileSave(
    blob,
    {
      fileName: `${opts.name}${extension ? `.${extension}` : ""}`,
      description: opts.description,
      extensions,
      mimeTypes: opts.mimeTypes,
    },
    opts.fileHandle ?? fileHandle ?? null,
    false,
  );
};

export { nativeFileSystemSupported };
