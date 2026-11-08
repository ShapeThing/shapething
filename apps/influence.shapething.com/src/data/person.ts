import type { Literal, NamedNode, Term } from "@rdfjs/types";
import { factory } from "../rdf/namespaces.ts";
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
  /** When a band was formed (P571, inception): its birth, so to speak. */
  inception?: Literal;
  /** When a band broke up (P576, dissolved): its death. */
  dissolved?: Literal;
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
  inception?: Literal;
  dissolved?: Literal;
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
    inception: first("inception"),
    dissolved: first("dissolved"),
    influence: Number.isFinite(influence) ? influence : 0,
  };
};

/** When a person was born, or a band formed. */
export const startOf = (person: PersonSummary): Literal | undefined =>
  person.birthDate ?? person.inception;

/** When a person died, or a band broke up. */
export const endOf = (person: PersonSummary): Literal | undefined =>
  person.deathDate ?? person.dissolved;

/**
 * Wikidata's description without the years at the end ("English pop rock band (1960–1970)"): a
 * person or a band shows the years from the dates, in a column, a search result and the summary of
 * the modal (inf:ModalSummary).
 */
const withoutYears = (description: Literal | undefined): Literal | undefined => {
  if (!description) return undefined;
  const value = description.value.replace(/\s*\([^()]*\d{3,4}[^()]*\)\s*$/u, "");
  return value === description.value ? description : factory.literal(value, description.language);
};

/** Groups the rows by item (?item in the queries), keeping the order of the query. */
export const summariesFromRows = (
  rows: ReadonlyArray<SummaryRow & { item: NamedNode }>,
): PersonSummary[] => {
  const groups = new Map<string, Array<SummaryRow & { item: NamedNode }>>();
  for (const row of rows) {
    const group = groups.get(row.item.value);
    if (group) group.push(row);
    else groups.set(row.item.value, [row]);
  }
  return [...groups.values()].map((group) => {
    const summary = summarize(group[0].item, group);
    return { ...summary, description: withoutYears(summary.description) };
  });
};

/** Everything shown in the modal: a person, but also a work, an interest or an idea. */
/**
 * What an entity is, judged by what Wikidata says about the entity itself, not by the list it was
 * opened from (one item can be the work of one person and the idea of another):
 * - a person is an instance of human (P31 Q5), or a band (a musical group, Q215380),
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
  /** The Open Library ID (P648) of a work, for its cover (data/openLibrary.ts). */
  openLibraryId?: Literal;
  /** The English name of an author (P50) of a work, to search Open Library for its cover. */
  authorName?: Literal;
  /** A book: its Open Library cover is preferred to its image (data/queries.ts). */
  isBook: boolean;
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
  openLibraryId?: Literal;
  authorName?: Literal;
  isPerson: Literal;
  isBook?: Literal;
  hasAuthor: Literal;
};

const isTrue = (literal: Literal) => literal.value === "true";

/** The usual endings of an English demonym that is an adjective: "British", "Burmese", "Icelandic". */
const adjectiveEnding = /(ish|ese|an|ic|i)$/;

/**
 * The demonym of a country as an adjective, the same on every load: the one qualified as the
 * adjective (the first in alphabetical order, should there be several). Most countries with more
 * than one demonym do not tell which is the adjective ("British", "Briton"): then a plural is
 * left out ("Brazilians" next to "Brazilian") and so is the name of the country itself ("Taiwan"
 * among Taiwan's), a capitalized one goes before a lowercase one, one
 * with the ending of an adjective before a noun ("Spanish" before "Spaniard"), and else the first
 * in alphabetical order.
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
  if (adjectives[0]) return adjectives[0];
  const values = new Set(all.map((demonym) => demonym.value));
  const names = new Set(
    rows.flatMap((row) => (row.citizenshipName ? [row.citizenshipName.value] : [])),
  );
  const singulars = all.filter(
    (demonym) =>
      !names.has(demonym.value) &&
      !(demonym.value.endsWith("s") && values.has(demonym.value.slice(0, -1))),
  );
  const rank = (demonym: Literal) =>
    (/^\p{Lu}/u.test(demonym.value) ? 0 : 2) + (adjectiveEnding.test(demonym.value) ? 0 : 1);
  return singulars.sort((a, b) => rank(a) - rank(b))[0];
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
  const isPerson = rows.some((row) => isTrue(row.isPerson));
  const summary = summarize(iri, rows);
  return {
    ...summary,
    description: isPerson ? withoutYears(summary.description) : summary.description,
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
    openLibraryId: rows.find((row) => row.openLibraryId)?.openLibraryId,
    authorName: rows.find((row) => row.authorName)?.authorName,
    isBook: rows.some((row) => row.isBook && isTrue(row.isBook)),
    kind: isPerson
      ? "person"
      : publicationDate || rows.some((row) => isTrue(row.hasAuthor))
        ? "work"
        : "concept",
  };
};

/**
 * The lists of a person (queries/itemLists.rq): what they made, by the kind of maker (a writer's
 * works, a musician's albums, a painter's artworks), and their ideas and interests.
 */
export const ITEM_KINDS = ["works", "albums", "artworks", "ideas", "interests"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export type ListItem = {
  iri: NamedNode;
  label?: Literal;
  description?: Literal;
  /** A Commons image (P18): the picture of a card in the modal. */
  image?: NamedNode;
  /** When a work was made (P571 inception). */
  inception?: Literal;
  publicationDate?: Literal;
  /** The Open Library ID (P648) of a work, for its cover (data/openLibrary.ts). */
  openLibraryId?: Literal;
  /** A book: its Open Library cover is preferred to its image (useCovers). */
  isBook?: boolean;
  /** The MusicBrainz release group (P436) of an album, for its cover (data/coverArtArchive.ts). */
  musicBrainzId?: Literal;
};

export type ItemLists = Record<ItemKind, ListItem[]>;

export type ItemListRow = {
  kind: Literal;
  item: NamedNode;
  /** From the label service: an English or "mul" label, else the identifier without a language. */
  name: Term;
  description?: Term;
  image?: NamedNode;
  inception?: Literal;
  publicationDate?: Literal;
  openLibraryId?: Literal;
  musicBrainzId?: Literal;
  isBook?: Literal;
};

const isItemKind = (kind: string): kind is ItemKind => ITEM_KINDS.includes(kind as ItemKind);

export const itemListsFromRows = (rows: readonly ItemListRow[]): ItemLists => {
  const lists = Object.fromEntries(ITEM_KINDS.map((kind) => [kind, []])) as unknown as ItemLists;
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
    // Like the name, a description without a language is no description.
    if (row.description?.termType === "Literal" && row.description.language) {
      item.description ??= row.description;
    }
    item.image ??= row.image;
    item.inception ??= row.inception;
    item.publicationDate ??= row.publicationDate;
    item.openLibraryId ??= row.openLibraryId;
    item.musicBrainzId ??= row.musicBrainzId;
    if (row.isBook && isTrue(row.isBook)) item.isBook = true;
  }

  return lists;
};
