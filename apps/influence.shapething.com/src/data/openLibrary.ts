import type { NamedNode } from "@rdfjs/types";
import { factory } from "../rdf/namespaces.ts";
import { fetchJson } from "../sparql/fetchJson.ts";
import { createRequestQueue } from "./requestQueue.ts";

/**
 * Covers from Open Library (https://openlibrary.org), for works that have no image (P18) on
 * Wikidata. A work is looked up by its Open Library ID (P648) when Wikidata has one, else searched
 * by its title and author.
 */

/** Open Library gets a few requests at a time. */
const withRequestSlot = createRequestQueue(3);

/** The cover image of an Open Library cover ID, at its large size (wsrv.nl resizes it). */
export const coverUrl = (coverId: number) => `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;

/**
 * The JSON URL of an Open Library ID: a work ("OL71164W") or an edition ("OL7173547M"), which both
 * list their covers. Author IDs ("…A") and anything else have no cover.
 */
export const recordUrl = (openLibraryId: string) => {
  const kind = /^OL\d+([WM])$/.exec(openLibraryId)?.[1];
  if (!kind) return undefined;
  return `https://openlibrary.org/${kind === "W" ? "works" : "books"}/${openLibraryId}.json`;
};

export const searchUrl = (title: string, author: string | undefined) =>
  `https://openlibrary.org/search.json?${new URLSearchParams({
    title,
    ...(author ? { author } : {}),
    fields: "key,cover_i",
    limit: "5",
  })}`;

const byId = async (openLibraryId: string) => {
  const url = recordUrl(openLibraryId);
  if (!url) return undefined;
  const json = (await fetchJson(url)) as { covers?: number[] };
  // Missing covers are listed as -1.
  return json.covers?.find((cover) => cover > 0);
};

const bySearch = async (title: string, author: string | undefined) => {
  const json = (await fetchJson(searchUrl(title, author))) as {
    docs?: Array<{ cover_i?: number }>;
  };
  return json.docs?.find((doc) => doc.cover_i && doc.cover_i > 0)?.cover_i;
};

/**
 * The cover of a work, or undefined when Open Library has none. Without an author the title alone
 * is too likely to find another book, so it is not searched.
 */
export const getOpenLibraryCover = async ({
  openLibraryId,
  title,
  author,
}: {
  openLibraryId?: string;
  title?: string;
  author?: string;
}): Promise<NamedNode | undefined> => {
  const cover = await withRequestSlot(
    async () =>
      (openLibraryId ? await byId(openLibraryId) : undefined) ??
      (title && author ? await bySearch(title, author) : undefined),
  );
  return cover ? factory.namedNode(coverUrl(cover)) : undefined;
};
