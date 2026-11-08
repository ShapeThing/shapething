import { useSyncExternalStore } from "react";

/**
 * Bookmarks are the paths of the app (/Q859,Q868), kept in localStorage under the same key as in
 * the previous version of the app, so existing bookmarks stay.
 */

const STORAGE_KEY = "saved";
const CHANGE_EVENT = "influence:bookmarks";

const read = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

export const parse = (serialized: string): string[] => {
  try {
    const value: unknown = JSON.parse(serialized);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const write = (paths: readonly string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Without storage (private browsing) bookmarks can not be kept.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
};

let cachedSerialized = "";
let cachedPaths: string[] = [];

const getSnapshot = () => {
  const serialized = read();
  if (serialized !== cachedSerialized) {
    cachedSerialized = serialized;
    cachedPaths = parse(serialized);
  }
  return cachedPaths;
};

export const useBookmarks = () => useSyncExternalStore(subscribe, getSnapshot);

export const addBookmark = (path: string) => {
  const paths = getSnapshot();
  if (!paths.includes(path)) write([...paths, path]);
};

export const removeBookmark = (path: string) =>
  write(getSnapshot().filter((item) => item !== path));
