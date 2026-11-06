import type { Literal, NamedNode } from "@rdfjs/types";
import { entityId } from "./entities.ts";

/**
 * What the app knows about a person in a column or a search result. The RDF terms are kept as the
 * query returned them, the display graphs (see graphs.ts) are made from them.
 */
export type PersonSummary = {
  iri: NamedNode;
  id: string;
  /** The English label, or else the "mul" (default for all languages) one. */
  label?: Literal;
  /** The label as text, or the identifier when there is no label. */
  name: string;
  description?: Literal;
  image?: NamedNode;
  birthDate?: Literal;
  deathDate?: Literal;
  /** How many people this person influenced, according to Wikidata. */
  influence: number;
};

/** The row variables the person queries (influenced.rq, influencers.rq, search.rq, entity.rq) share. */
export type SummaryRow = {
  name?: Literal;
  mulName?: Literal;
  description?: Literal;
  image?: NamedNode;
  birthDate?: Literal;
  deathDate?: Literal;
  influence: Literal;
};

/**
 * The rows of one person: a person with, for example, two images or two birth dates has a row for
 * each combination. Each value is taken from the first row that has one.
 */
export const summarize = (iri: NamedNode, rows: readonly SummaryRow[]): PersonSummary => {
  const first = <Key extends keyof SummaryRow>(key: Key): SummaryRow[Key] | undefined =>
    rows.find((row) => row[key] !== undefined)?.[key];

  const id = entityId(iri) ?? iri.value;
  const label = first("name") ?? first("mulName");
  const influence = Number.parseInt(first("influence")?.value ?? "", 10);

  return {
    iri,
    id,
    label,
    name: label?.value ?? id,
    description: first("description"),
    image: first("image"),
    birthDate: first("birthDate"),
    deathDate: first("deathDate"),
    influence: Number.isFinite(influence) ? influence : 0,
  };
};

/** Groups the rows by person, keeping the order of the query. */
export const summariesFromRows = (
  rows: ReadonlyArray<SummaryRow & { person: NamedNode }>,
): PersonSummary[] => {
  const groups = new Map<string, Array<SummaryRow & { person: NamedNode }>>();
  for (const row of rows) {
    const group = groups.get(row.person.value);
    if (group) group.push(row);
    else groups.set(row.person.value, [row]);
  }
  return [...groups.values()].map((group) => summarize(group[0].person, group));
};

/** Everything shown in the modal: a person, but also a work, an interest or an idea. */
export type EntityDetails = PersonSummary & {
  publicationDate?: Literal;
  /** The English Wikipedia article about the entity. */
  article?: NamedNode;
  isHuman: boolean;
};

export type EntityRow = SummaryRow & {
  publicationDate?: Literal;
  article?: NamedNode;
  isHuman: Literal;
};

export const entityFromRows = (iri: NamedNode, rows: readonly EntityRow[]): EntityDetails => ({
  ...summarize(iri, rows),
  publicationDate: rows.find((row) => row.publicationDate)?.publicationDate,
  article: rows.find((row) => row.article)?.article,
  isHuman: rows.some((row) => row.isHuman.value === "true"),
});

export type ItemKind = "works" | "interests" | "ideas";

export type ListItem = {
  iri: NamedNode;
  label?: Literal;
  publicationDate?: Literal;
};

export type ItemLists = Record<ItemKind, ListItem[]>;

export type ItemListRow = {
  kind: Literal;
  item: NamedNode;
  name?: Literal;
  mulName?: Literal;
  publicationDate?: Literal;
};

const isItemKind = (kind: string): kind is ItemKind =>
  kind === "works" || kind === "interests" || kind === "ideas";

export const itemListsFromRows = (rows: readonly ItemListRow[]): ItemLists => {
  const lists: ItemLists = { works: [], interests: [], ideas: [] };
  const seen = new Map<string, ListItem>();

  for (const row of rows) {
    const kind = row.kind.value;
    if (!isItemKind(kind)) continue;
    // Without an English or "mul" label there is nothing readable to list.
    if (!row.name && !row.mulName) continue;

    const key = `${kind} ${row.item.value}`;
    let item = seen.get(key);
    if (!item) {
      item = { iri: row.item };
      seen.set(key, item);
      lists[kind].push(item);
    }
    // An English label wins over a "mul" one, from whichever row it comes.
    if (row.name) item.label = row.name;
    else item.label ??= row.mulName;
    item.publicationDate ??= row.publicationDate;
  }

  return lists;
};
