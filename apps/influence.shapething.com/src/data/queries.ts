import type { NamedNode } from "@rdfjs/types";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import allPropertiesQuery from "../queries/allProperties.rq?raw";
import entityQuery from "../queries/entity.rq";
import influencedQuery from "../queries/influenced.rq";
import influencersQuery from "../queries/influencers.rq";
import influentialQuery from "../queries/influential.rq";
import itemListsQuery from "../queries/itemLists.rq";
import labelsQuery from "../queries/labels.rq";
import occupationsQuery from "../queries/occupations.rq";
import searchQuery from "../queries/search.rq";
import { factory, wdt } from "../rdf/namespaces.ts";
import { construct, select } from "../sparql/select.ts";
import { entityId, entityIri } from "./entities.ts";
import { getAlbumCover } from "./coverArtArchive.ts";
import { getOpenLibraryCover } from "./openLibrary.ts";
import {
  entityFromRows,
  type ItemKind,
  type ItemLists,
  itemListsFromRows,
  summariesFromRows,
} from "./person.ts";
import type { SearchClass } from "./searchClasses.ts";
import { getWikipediaAbstract } from "./wikipedia.ts";

/** The shortest search text that is sent to Wikidata. */
export const MINIMUM_SEARCH_LENGTH = 3;

export type InfluenceDirection = "influencers" | "influenced";

export const entityOptions = (id: string) =>
  queryOptions({
    queryKey: ["entity", id],
    queryFn: async () => {
      const iri = entityIri(id);
      // The occupations have a query of their own: in the entity query each one would be a row
      // for every combination of the other values.
      const [rows, occupationRows] = await Promise.all([
        select(entityQuery, { entity: iri }),
        select(occupationsQuery, { entity: iri }),
      ]);
      const entity = entityFromRows(iri, rows, occupationRows);
      // A book shows its Open Library cover, also when Wikidata has an image (often a photo of a
      // copy, or a page). Another work without an image gets one from Open Library too, when it has
      // one. The modal is still shown without it.
      if (entity.kind === "work" && (entity.isBook || !entity.image)) {
        const cover = await getOpenLibraryCover({
          openLibraryId: entity.openLibraryId?.value,
          title: entity.label?.value,
          author: entity.authorName?.value,
        }).catch(() => undefined);
        entity.image = cover ?? entity.image;
      }
      return entity;
    },
  });

/** The people that influenced `id` ("influencers"), or that `id` influenced ("influenced"). */
export const influenceOptions = (id: string, direction: InfluenceDirection) =>
  queryOptions({
    queryKey: ["influence", direction, id],
    queryFn: async () =>
      summariesFromRows(
        await select(direction === "influenced" ? influencedQuery : influencersQuery, {
          subject: entityIri(id),
        }),
      ),
  });

/** How a thing has the class: wdt:P31 (instance of) or wdt:P106 (occupation). */
const membership = (searchClass: SearchClass) => wdt(searchClass.property ?? "P31");

/**
 * The most influential of a class (queries/influential.rq): where "Surprise me" starts, for the
 * class chosen in the search.
 */
export const influentialOptions = (searchClass: SearchClass) =>
  queryOptions({
    queryKey: ["influential", searchClass.id],
    queryFn: async () =>
      summariesFromRows(
        await select(influentialQuery, {
          class: entityIri(searchClass.id),
          membership: membership(searchClass),
        }),
      ),
  });

export const useEntity = (id: string | undefined) =>
  useQuery({ ...entityOptions(id ?? ""), enabled: id !== undefined });

export const useItemLists = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["itemLists", id],
    queryFn: async () =>
      itemListsFromRows(await select(itemListsQuery, { subject: entityIri(id) })),
    enabled,
  });

/**
 * Where the cover of a list item comes from, if anywhere: a book, and another work without an
 * image, from Open Library (data/openLibrary.ts); an album from the Cover Art Archive
 * (data/coverArtArchive.ts). A cover is preferred to the item's image on Wikidata, which for a book
 * or an album is often a photo of a copy.
 */
const coverLookups = (lists: ItemLists, kind: ItemKind, author: string | undefined) => [
  ...(kind === "works" ? lists.works : [])
    .filter((work) => work.isBook || !work.image)
    .map((work) => ({
      item: work,
      queryKey: ["cover", work.iri.value, author],
      fetch: () =>
        getOpenLibraryCover({
          openLibraryId: work.openLibraryId?.value,
          title: work.label?.value,
          author,
        }),
    })),
  ...(kind === "albums" ? lists.albums : []).flatMap((album) => {
    const musicBrainzId = album.musicBrainzId?.value;
    return musicBrainzId
      ? [
          {
            item: album,
            queryKey: ["albumCover", musicBrainzId],
            fetch: () => getAlbumCover(musicBrainzId),
          },
        ]
      : [];
  }),
];

/**
 * The covers of the items of one of a person's lists (coverLookups), the one shown, by item IRI.
 * Each is added when it is found; the map only changes when another cover arrives.
 */
export const useCovers = (
  lists: ItemLists,
  kind: ItemKind,
  author: string | undefined,
): ReadonlyMap<string, NamedNode> => {
  const lookups = coverLookups(lists, kind, author);
  const results = useQueries({
    queries: lookups.map(({ queryKey, fetch }) => ({
      queryKey,
      // Without a cover the item keeps its own image, or none.
      queryFn: async () => (await fetch().catch(() => undefined)) ?? null,
      staleTime: Infinity,
    })),
  });
  // The covers found so far as text, so the map is only made again when another one arrives.
  const covers = lookups
    .flatMap(({ item }, index) => {
      const cover = results[index]?.data;
      return cover ? [`${item.iri.value} ${cover.value}`] : [];
    })
    .join("\n");

  return useMemo(
    () =>
      new Map(
        covers
          ? covers.split("\n").map((line) => {
              const [item, cover] = line.split(" ");
              return [item, factory.namedNode(cover)] as const;
            })
          : [],
      ),
    [covers],
  );
};

export const useAbstract = (article: NamedNode | undefined) =>
  useQuery({
    queryKey: ["abstract", article?.value],
    // Without the introduction the modal still has the rest to show.
    queryFn: async () =>
      article ? ((await getWikipediaAbstract(article).catch(() => undefined)) ?? null) : null,
    enabled: article !== undefined,
  });

/**
 * Every property of an entity with its values but its external identifiers, and the names of its
 * properties and items, for the second renderer of the modal (queries/allProperties.rq).
 */
export const useAllProperties = (id: string) =>
  useQuery({
    queryKey: ["allProperties", id],
    queryFn: () => construct(allPropertiesQuery, { entity: entityIri(id) }),
  });

/** The words of a search text, in lower case: the other characters are search syntax. */
const searchWords = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** The parameters of search.rq for a search text in a class (see there). */
export const searchParameters = (text: string, searchClass: SearchClass) => {
  const words = searchWords(text);
  // Only direct instances of the classes, when the class has them: the full-text search knows no
  // subclasses. Without them the words alone, the query keeps the class.
  const classes = searchClass.directClasses
    ?.map((id) => `${searchClass.property ?? "P31"}=${id}`)
    .join("|");
  return {
    search: factory.literal(text),
    fullText: factory.literal(
      classes ? `${words.join(" ")} haswbstatement:${classes}` : words.join(" "),
    ),
    class: entityIri(searchClass.id),
    membership: membership(searchClass),
    // Every word starts a word of the name, in any order (Java regular expressions).
    namePattern: factory.literal(words.map((word) => `(?=.*(^|[^\\p{L}\\p{N}])${word})`).join("")),
  };
};

export const useSearch = (text: string, searchClass: SearchClass) => {
  const searchText = text.trim();
  return useQuery({
    queryKey: ["search", searchClass.id, searchText],
    queryFn: async () =>
      summariesFromRows(await select(searchQuery, searchParameters(searchText, searchClass))),
    enabled: searchText.length >= MINIMUM_SEARCH_LENGTH,
  });
};

/** The names of Wikidata items, by identifier. */
export const useNames = (ids: readonly string[]) => {
  const uniqueIds = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["names", uniqueIds],
    queryFn: async () => {
      const rows = await select(labelsQuery, { entity: uniqueIds.map(entityIri) });
      const names = new Map<string, string>();
      for (const row of rows) {
        const id = row.entity && entityId(row.entity);
        const name = row.name ?? row.mulName;
        // An English name wins over a "mul" one, from whichever row it comes.
        if (id && name && (row.name || !names.has(id))) names.set(id, name.value);
      }
      return names;
    },
    enabled: uniqueIds.length > 0,
  });
};
