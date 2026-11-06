import type { NamedNode } from "@rdfjs/types";
import { queryOptions, useQuery } from "@tanstack/react-query";
import entityQuery from "../queries/entity.rq";
import influencedQuery from "../queries/influenced.rq";
import influencersQuery from "../queries/influencers.rq";
import itemListsQuery from "../queries/itemLists.rq";
import labelsQuery from "../queries/labels.rq";
import occupationsQuery from "../queries/occupations.rq";
import resourceLabelsQuery from "../queries/resourceLabels.rq";
import searchQuery from "../queries/search.rq";
import { factory } from "../rdf/namespaces.ts";
import { select } from "../sparql/select.ts";
import { entityId, entityIri } from "./entities.ts";
import { entityFromRows, itemListsFromRows, summariesFromRows } from "./person.ts";
import { fetchResource } from "./resource.ts";
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
 * Every property of an entity with its values, for the second renderer of the modal: the resource
 * itself from the resource fetcher, the names of its properties and items from one more query.
 */
export const useAllProperties = (id: string) =>
  useQuery({
    queryKey: ["allProperties", id],
    queryFn: async () => {
      const iri = entityIri(id);
      const [resource, labelRows] = await Promise.all([
        fetchResource(iri),
        select(resourceLabelsQuery, { entity: iri }),
      ]);
      // The graphs are made in the modal, which knows what it shows elsewhere (see EntityModal).
      return { iri, resource, labelRows };
    },
  });

export const useSearch = (text: string) => {
  const searchText = text.trim();
  return useQuery({
    queryKey: ["search", searchText],
    queryFn: async () =>
      summariesFromRows(await select(searchQuery, { search: factory.literal(searchText) })),
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
