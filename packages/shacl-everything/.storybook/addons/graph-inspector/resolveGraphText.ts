import type { RdfSource } from "../../../src/types/RdfSource.ts";
import type { GraphText } from "./constants.ts";

const filenameFromUrl = (url: URL): string =>
  url.pathname.split("/").pop() || url.href;

const fetchText = async (url: URL): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    return `Failed to fetch ${url.href}: ${response.status} ${response.statusText}`;
  }
  return response.text();
};

export const resolveGraphText = async (
  source: RdfSource | undefined,
): Promise<GraphText | undefined> => {
  if (source === undefined) return undefined;
  if (source instanceof URL) {
    // Same "strip the fragment" trick as resolveRdfSources.ts - the fragment identifies a node,
    // not a separate file to fetch.
    const hashlessUrl = new URL(source.href.split("#")[0]);
    return {
      label: filenameFromUrl(source),
      text: await fetchText(hashlessUrl),
      href: hashlessUrl.href,
    };
  }
  if (typeof source === "string") {
    return { label: "inline string", text: source.trim() };
  }
  return {
    label: "parsed graph (RdfStore/DatasetCore/Quad[] - no raw source text)",
  };
};
