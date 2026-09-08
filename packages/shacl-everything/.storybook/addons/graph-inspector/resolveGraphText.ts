import type { RdfSource } from "../../../src/types/RdfSource.ts";
import type { GraphFileText, GraphText } from "./constants.ts";

const filenameFromUrl = (url: URL): string => url.pathname.split("/").pop() || url.href;

const fetchText = async (url: URL): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    return `Failed to fetch ${url.href}: ${response.status} ${response.statusText}`;
  }
  return response.text();
};

// Same "a non-empty array is a Quad[] only if its first element looks like a Quad, otherwise it's
// a list of RdfSources to merge" disambiguation as resolveRdfSources.ts's isRdfSourceList/isQuad -
// kept in sync with that logic rather than imported, since it's a tiny, presentation-only check.
const isQuad = (value: unknown): boolean =>
  value !== null &&
  typeof value === "object" &&
  "subject" in value &&
  "predicate" in value &&
  "object" in value &&
  "graph" in value;

const isRdfSourceList = (source: RdfSource): source is readonly RdfSource[] =>
  Array.isArray(source) && source.length > 0 && !isQuad(source[0]);

const resolveGraphFiles = async (source: RdfSource): Promise<GraphFileText[]> => {
  if (isRdfSourceList(source)) {
    const nested = await Promise.all(source.map(resolveGraphFiles));
    return nested.flat();
  }
  if (source instanceof URL) {
    // Same "strip the fragment" trick as resolveRdfSources.ts - the fragment identifies a node,
    // not a separate file to fetch.
    const hashlessUrl = new URL(source.href.split("#")[0]);
    return [
      {
        label: filenameFromUrl(source),
        text: await fetchText(hashlessUrl),
        href: hashlessUrl.href,
      },
    ];
  }
  if (typeof source === "string") {
    return [{ label: "inline string", text: source.trim() }];
  }
  return [{ label: "parsed graph (RdfStore/DatasetCore/Quad[] - no raw source text)" }];
};

export const resolveGraphText = async (
  source: RdfSource | undefined,
): Promise<GraphText | undefined> => {
  if (source === undefined) return undefined;
  return { files: await resolveGraphFiles(source) };
};
