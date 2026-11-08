import type { NamedNode } from "@rdfjs/types";
import { factory } from "../rdf/namespaces.ts";
import { fetchJson } from "../sparql/fetchJson.ts";
import { createRequestQueue } from "./requestQueue.ts";

/**
 * Album covers from the Cover Art Archive (https://coverartarchive.org), by the MusicBrainz release
 * group (P436) of an album on Wikidata. An album's image on Wikidata is often a photo of the record,
 * when it has one at all: album covers are rarely free to put on Commons.
 */

/** The Cover Art Archive gets a few requests at a time. */
const withRequestSlot = createRequestQueue(3);

export const releaseGroupUrl = (musicBrainzId: string) =>
  `https://coverartarchive.org/release-group/${encodeURIComponent(musicBrainzId)}`;

type CoverArtImage = {
  front?: boolean;
  image?: string;
  /** "500" and "250" for newer images, "large" and "small" for older ones. */
  thumbnails?: Record<string, string | undefined>;
};

/** The front cover of a release group's listing, at about 500px wide, over https. */
export const frontCoverUrl = (images: readonly CoverArtImage[]) => {
  const front = images.find((image) => image.front);
  const url = front?.thumbnails?.["500"] ?? front?.thumbnails?.large ?? front?.image;
  return url?.replace(/^http:/, "https:");
};

/** The front cover of an album, or undefined when the Cover Art Archive has none. */
export const getAlbumCover = async (musicBrainzId: string): Promise<NamedNode | undefined> => {
  const json = (await withRequestSlot(() => fetchJson(releaseGroupUrl(musicBrainzId)))) as {
    images?: CoverArtImage[];
  };
  const url = frontCoverUrl(json.images ?? []);
  return url ? factory.namedNode(url) : undefined;
};
