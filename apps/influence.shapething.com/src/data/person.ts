import type { Literal, NamedNode, Term } from "@rdfjs/types";
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
/**
 * What an entity is, judged by what Wikidata says about the entity itself, not by the list it was
 * opened from (one item can be the work of one person and the idea of another):
 * - a person is an instance of human (P31 Q5),
 * - a work has an author (P50) or a publication date (P577),
 * - a concept is anything else: the interests and the ideas that are not works.
 */
export type EntityKind = "person" | "work" | "concept";

/** A place of birth with its coordinates (P625, a WKT point), for the map in the modal. */
export type BirthPlace = {
  iri: NamedNode;
  name?: Literal;
  location: Literal;
};

/** A country of citizenship with its flag (P41, a Commons image), for the modal. */
export type Citizenship = {
  iri: NamedNode;
  name?: Literal;
  flag: NamedNode;
  /** The English demonym (P1549) as an adjective, "Danish": for the summary of a person. */
  demonym?: Literal;
};

/** An occupation (P106) with its name. */
export type Occupation = {
  iri: NamedNode;
  name: Literal;
};

export type OccupationRow = {
  occupation: NamedNode;
  name?: Literal;
  mulName?: Literal;
};

export type EntityDetails = PersonSummary & {
  /** The name in the entity's own language (P1559), often the full name of a person. */
  fullName?: Literal;
  /** The page banner (P948): a wide Commons image, across the top of the modal. */
  banner?: NamedNode;
  publicationDate?: Literal;
  birthPlace?: BirthPlace;
  citizenships: Citizenship[];
  occupations: Occupation[];
  /** The English Wikipedia article about the entity. */
  article?: NamedNode;
  kind: EntityKind;
};

export type EntityRow = SummaryRow & {
  fullName?: Literal;
  banner?: NamedNode;
  publicationDate?: Literal;
  birthPlace?: NamedNode;
  birthPlaceName?: Literal;
  birthPlaceLocation?: Literal;
  citizenship?: NamedNode;
  citizenshipName?: Literal;
  flag?: NamedNode;
  demonym?: Literal;
  demonymIsAdjective?: Literal;
  article?: NamedNode;
  isHuman: Literal;
  hasAuthor: Literal;
};

const isTrue = (literal: Literal) => literal.value === "true";

/**
 * The demonym of a country as an adjective, the same on every load: the one qualified as the
 * adjective (the first in alphabetical order, should there be several), else the only one there
 * is. A country with only nouns and adjectives that are not told apart ("British", "Briton") has
 * none.
 */
const demonymOf = (rows: readonly EntityRow[]): Literal | undefined => {
  const byValue = (demonyms: Literal[]) =>
    [...new Map(demonyms.map((demonym) => [demonym.value, demonym])).values()].sort((a, b) =>
      a.value.localeCompare(b.value),
    );
  const all = byValue(rows.flatMap((row) => (row.demonym ? [row.demonym] : [])));
  const adjectives = byValue(
    rows.flatMap((row) =>
      row.demonym && row.demonymIsAdjective && isTrue(row.demonymIsAdjective) ? [row.demonym] : [],
    ),
  );
  return adjectives[0] ?? (all.length === 1 ? all[0] : undefined);
};

export const entityFromRows = (
  iri: NamedNode,
  rows: readonly EntityRow[],
  occupationRows: readonly OccupationRow[] = [],
): EntityDetails => {
  // One per occupation, its English name before a "mul" one.
  const occupations = new Map<string, Occupation>();
  for (const row of occupationRows) {
    const name = row.name ?? row.mulName;
    const occupation = occupations.get(row.occupation.value);
    if (!name) continue;
    if (!occupation) occupations.set(row.occupation.value, { iri: row.occupation, name });
    else if (row.name) occupation.name = row.name;
  }

  const publicationDate = rows.find((row) => row.publicationDate)?.publicationDate;
  const birthPlaceRow = rows.find((row) => row.birthPlace && row.birthPlaceLocation);
  // One flag per country, in the order of the rows; a name from whichever row has one.
  const citizenships = new Map<string, Citizenship>();
  for (const row of rows) {
    if (!row.citizenship || !row.flag) continue;
    const citizenship = citizenships.get(row.citizenship.value) ?? {
      iri: row.citizenship,
      flag: row.flag,
    };
    citizenship.name ??= row.citizenshipName;
    citizenships.set(row.citizenship.value, citizenship);
  }
  for (const citizenship of citizenships.values()) {
    citizenship.demonym = demonymOf(rows.filter((row) => row.citizenship?.equals(citizenship.iri)));
  }
  return {
    ...summarize(iri, rows),
    fullName: rows.find((row) => row.fullName)?.fullName,
    banner: rows.find((row) => row.banner)?.banner,
    publicationDate,
    citizenships: [...citizenships.values()],
    occupations: [...occupations.values()],
    birthPlace:
      birthPlaceRow?.birthPlace && birthPlaceRow.birthPlaceLocation
        ? {
            iri: birthPlaceRow.birthPlace,
            name: rows.find(
              (row) => row.birthPlace?.equals(birthPlaceRow.birthPlace!) && row.birthPlaceName,
            )?.birthPlaceName,
            location: birthPlaceRow.birthPlaceLocation,
          }
        : undefined,
    article: rows.find((row) => row.article)?.article,
    kind: rows.some((row) => isTrue(row.isHuman))
      ? "person"
      : publicationDate || rows.some((row) => isTrue(row.hasAuthor))
        ? "work"
        : "concept",
  };
};

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
  /** From the label service: an English or "mul" label, else the identifier without a language. */
  name: Term;
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
    const label = row.name.termType === "Literal" && row.name.language ? row.name : undefined;
    if (!label) continue;

    const key = `${kind} ${row.item.value}`;
    let item = seen.get(key);
    if (!item) {
      item = { iri: row.item };
      seen.set(key, item);
      lists[kind].push(item);
    }
    item.label ??= label;
    item.publicationDate ??= row.publicationDate;
  }

  return lists;
};
