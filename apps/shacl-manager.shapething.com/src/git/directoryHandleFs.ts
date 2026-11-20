// The `fs` isomorphic-git asks for, on top of a folder the user connected through the File System
// Access API. Paths are absolute from the folder: "/.git/HEAD", "/model.ttl".

type FsError = Error & { code: string };

const fsError = (code: string, path: string): FsError =>
  Object.assign(new Error(`${code}: ${path}`), { code });

const segments = (path: string) => path.split("/").filter((part) => part && part !== ".");

const isNotFound = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === "NotFoundError" || error.name === "TypeMismatchError");

async function directoryAt(root: FileSystemDirectoryHandle, parts: string[], path: string) {
  let directory = root;
  for (const part of parts) {
    try {
      directory = await directory.getDirectoryHandle(part);
    } catch (error) {
      throw isNotFound(error) ? fsError("ENOENT", path) : error;
    }
  }
  return directory;
}

async function parentAndName(root: FileSystemDirectoryHandle, path: string) {
  const parts = segments(path);
  const name = parts.pop();
  if (!name) throw fsError("EPERM", path);
  return { parent: await directoryAt(root, parts, path), name };
}

async function entryAt(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle | FileSystemFileHandle> {
  if (segments(path).length === 0) return root;
  const { parent, name } = await parentAndName(root, path);
  try {
    return await parent.getFileHandle(name);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  try {
    return await parent.getDirectoryHandle(name);
  } catch (error) {
    throw isNotFound(error) ? fsError("ENOENT", path) : error;
  }
}

// The folder has no inodes, owners or permission bits: git compares these with what is in its
// index, and on a mismatch it reads and hashes the file instead, which gives the right answer.
function stats(kind: "file" | "directory", size: number, mtimeMs: number) {
  return {
    type: kind,
    mode: kind === "file" ? 0o100644 : 0o40000,
    size,
    ino: 0,
    uid: 0,
    gid: 0,
    dev: 0,
    mtimeMs,
    ctimeMs: mtimeMs,
    isFile: () => kind === "file",
    isDirectory: () => kind === "directory",
    isSymbolicLink: () => false,
  };
}

export function directoryHandleFs(root: FileSystemDirectoryHandle) {
  const stat = async (path: string) => {
    const entry = await entryAt(root, path);
    if (entry.kind === "directory") return stats("directory", 0, 0);
    const file = await entry.getFile();
    return stats("file", file.size, file.lastModified);
  };

  const promises = {
    async readFile(path: string, options?: { encoding?: string } | string) {
      const entry = await entryAt(root, path);
      if (entry.kind !== "file") throw fsError("EISDIR", path);
      const file = await entry.getFile();
      const encoding = typeof options === "string" ? options : options?.encoding;
      return encoding ? file.text() : new Uint8Array(await file.arrayBuffer());
    },

    async writeFile(path: string, data: Uint8Array | string) {
      const { parent, name } = await parentAndName(root, path);
      const handle = await parent.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(data as FileSystemWriteChunkType);
      await writable.close();
    },

    async unlink(path: string) {
      const { parent, name } = await parentAndName(root, path);
      try {
        await parent.removeEntry(name);
      } catch (error) {
        throw isNotFound(error) ? fsError("ENOENT", path) : error;
      }
    },

    async readdir(path: string) {
      const entry = await entryAt(root, path);
      if (entry.kind !== "directory") throw fsError("ENOTDIR", path);
      const names: string[] = [];
      for await (const name of entry.keys()) names.push(name);
      return names;
    },

    async mkdir(path: string) {
      const { parent, name } = await parentAndName(root, path);
      try {
        await parent.getDirectoryHandle(name);
        throw fsError("EEXIST", path);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      await parent.getDirectoryHandle(name, { create: true });
    },

    async rmdir(path: string) {
      const { parent, name } = await parentAndName(root, path);
      try {
        await parent.removeEntry(name);
      } catch (error) {
        if (isNotFound(error)) throw fsError("ENOENT", path);
        if (error instanceof DOMException && error.name === "InvalidModificationError") {
          throw fsError("ENOTEMPTY", path);
        }
        throw error;
      }
    },

    stat,
    lstat: stat,

    async readlink(path: string): Promise<string> {
      throw fsError("ENOTSUP", path);
    },

    async symlink(_target: string, path: string) {
      throw fsError("ENOTSUP", path);
    },

    async chmod() {},
  };

  return { promises };
}
