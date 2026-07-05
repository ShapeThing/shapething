import { nonNullable } from './nonNullable.ts'

const getHandleByPath = async (
  path: string,
  root: FileSystemDirectoryHandle,
  create?: boolean
): Promise<FileSystemDirectoryHandle | FileSystemFileHandle> => {
  const pathParts = path.split('/').filter(nonNullable)
  let nextPathPart = pathParts.shift()
  let pointer: FileSystemDirectoryHandle = root

  while (pointer && nextPathPart) {
    try {
      if (pathParts.length > 0) {
        pointer = await pointer.getDirectoryHandle(nextPathPart, { create })
      } else {
        /** @ts-expect-error When we get here the type changes */
        pointer = await pointer.getFileHandle(nextPathPart, { create })
      }
    } catch {
      try {
        /** @ts-expect-error When we get here the type changes */
        pointer = await pointer.getFileHandle(nextPathPart, { create })
      } catch {}
    }
    nextPathPart = pathParts.shift()
  }

  return pointer as unknown as FileSystemFileHandle
}

export const getFileHandleByPath = async (
  path: string,
  root: FileSystemDirectoryHandle,
  create?: boolean
): Promise<FileSystemFileHandle | undefined> => {
  const result = await getHandleByPath(path, root, create)
  // The file did not exists and we are left with a directory.
  if (result.kind !== 'file') return undefined
  return result
}

export const getDirectoryHandleByPath = async (
  path: string,
  root: FileSystemDirectoryHandle,
  create?: boolean
): Promise<FileSystemDirectoryHandle> => {
  const result = await getHandleByPath(path, root, create)
  if (result.kind !== 'directory') throw new Error('Was expecting a directory')
  return result
}
