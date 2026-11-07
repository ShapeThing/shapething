import type { NamedNode } from "@rdfjs/types";
import { queryOptions, useQuery } from "@tanstack/react-query";
import allPropertiesQuery from "../queries/allProperties.rq?raw";
import entityQuery from "../queries/entity.rq";
import influencedQuery from "../queries/influenced.rq";
import influencersQuery from "../queries/influencers.rq";
import itemListsQuery from "../queries/itemLists.rq";
import labelsQuery from "../queries/labels.rq";
import occupationsQuery from "../queries/occupations.rq";
import searchQuery from "../queries/search.rq";
import { factory } from "../rdf/namespaces.ts";
import { construct, select } from "../sparql/select.ts";
import { entityId, entityIri } from "./entities.ts";
import { entityFromRows, itemListsFromRows, summariesFromRows } from "./person.ts";
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
      return entityFromRows(iri, rows, occupationRows);
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

export const useEntity = (id: string | undefined) =>
  useQuery({ ...entityOptions(id ?? ""), enabled: id !== undefined });

export const useItemLists = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["itemLists", id],
    queryFn: async () =>
      itemListsFromRows(await select(itemListsQuery, { subject: entityIri(id) })),
    enabled,
  });

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

/** The parameters of search.rq for a search text (see there). */
export const searchParameters = (text: string) => {
  const words = searchWords(text);
  return {
    search: factory.literal(text),
    fullText: factory.literal(`${words.join(" ")} haswbstatement:P31=Q5`),
    // Every word starts a word of the name, in any order (Java regular expressions).
    namePattern: factory.literal(words.map((word) => `(?=.*(^|[^\\p{L}\\p{N}])${word})`).join("")),
  };
};

export const useSearch = (text: string) => {
  const searchText = text.trim();
  return useQuery({
    queryKey: ["search", searchText],
    queryFn: async () => summariesFromRows(await select(searchQuery, searchParameters(searchText))),
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
