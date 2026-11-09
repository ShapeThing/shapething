import type { NamedNode } from "@rdfjs/types";
import { queryOptions, useQuery } from "@tanstack/react-query";
import allPropertiesQuery from "../queries/allProperties.rq?raw";
import entityQuery from "../queries/entity.rq?raw";
import influencedQuery from "../queries/influenced.rq?raw";
import influencersQuery from "../queries/influencers.rq?raw";
import influentialQuery from "../queries/influential.rq";
import itemListsQuery from "../queries/itemLists.rq?raw";
import labelsQuery from "../queries/labels.rq";
import searchQuery from "../queries/search.rq?raw";
import { factory, wdt } from "../rdf/namespaces.ts";
import { construct, select } from "../sparql/select.ts";
import { entityId, entityIri } from "./entities.ts";
import { modelClasses } from "../shapes/shapes.ts";
import type { SearchClass } from "./searchClasses.ts";
import { getWikipediaAbstract } from "./wikipedia.ts";

/** The shortest search text that is sent to Wikidata. */
export const MINIMUM_SEARCH_LENGTH = 3;

export type InfluenceDirection = "influencers" | "influenced";

/** Everything the modal shows about an entity (queries/entity.rq): Wikidata's triples. */
export const entityOptions = (id: string) =>
  queryOptions({
    queryKey: ["entity", id],
    queryFn: () => construct(entityQuery, { entity: entityIri(id), modelClass: modelClasses }),
  });

/**
 * The ones that influenced `id` ("influencers"), or that `id` influenced ("influenced"): the
 * triples a column shape lists them by (wdt:P737), with their data for inf:TeaserShape.
 */
export const influenceOptions = (id: string, direction: InfluenceDirection) =>
  queryOptions({
    queryKey: ["influence", direction, id],
    queryFn: () =>
      construct(direction === "influenced" ? influencedQuery : influencersQuery, {
        subject: entityIri(id),
      }),
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
      (
        await select(influentialQuery, {
          class: entityIri(searchClass.id),
          membership: membership(searchClass),
        })
      ).flatMap(({ item }) => entityId(item) ?? []),
  });

export const useEntity = (id: string | undefined) =>
  useQuery({ ...entityOptions(id ?? ""), enabled: id !== undefined });

/** What a person made, their ideas and interests, and their life events (queries/itemLists.rq). */
export const useItemLists = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ["itemLists", id],
    queryFn: () => construct(itemListsQuery, { subject: entityIri(id) }),
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

/** The node the search query gives its results to (inf:result, inf:SearchResultsShape). */
export const SEARCH_RESULTS = factory.namedNode("urn:influence:search");

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
    queryFn: () => construct(searchQuery, searchParameters(searchText, searchClass)),
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
