import type { PersonSummary } from "./data/person.ts";
import { yearOf } from "./widgets/YearViewer/year.ts";

/**
 * How the people of a column are sorted. "influence" (the order of the query, the most influential
 * first) is the default; the others are kept in the path, see parseSegment.
 */
export type SortOrder = "influence" | "born" | "name";

export const SORT_LABELS: Record<SortOrder, string> = {
  influence: "Most influential",
  born: "Born earliest",
  name: "Name",
};

/**
 * The sort order of a column is kept under the column's key: "influencers" for the influencers of
 * the first person, the identifier of a person for the people they influenced.
 */
export type Sorts = ReadonlyMap<string, SortOrder>;

/** The sort orders as one character in the path; the default has none. */
const CODES: Record<SortOrder, string> = { influence: "", born: "b", name: "n" };

const orderOfCode = (code: string | undefined) =>
  (Object.keys(CODES) as SortOrder[]).find((order) => code && CODES[order] === code);

/**
 * One person in the path, with the sort orders of the columns beside them, the way the columns
 * stand on the screen: a code after the identifier sorts the column after it (the people they
 * influenced), a code before the first identifier the column before it (the influencers).
 * "n:Q6512:b" is Søren Kierkegaard, his influencers by name, the people he influenced by birth year.
 * Without a code (or with an unknown one) the order is the default. Anything else (an old URL with a
 * Wikipedia title) is an identifier as it is.
 */
export type Segment = { id: string; before?: SortOrder; after?: SortOrder };

export const parseSegment = (segment: string): Segment => {
  const match = /^(?:(\w):)?(Q\d+)(?::(\w))?$/.exec(segment);
  if (!match) return { id: segment };
  return { id: match[2], before: orderOfCode(match[1]), after: orderOfCode(match[3]) };
};

/** The sort orders of the segments of a path, by column key. */
export const sortsFromSegments = (segments: readonly Segment[]): Sorts => {
  const sorts = new Map<string, SortOrder>();
  segments.forEach(({ id, before, after }, index) => {
    if (index === 0 && before) sorts.set("influencers", before);
    if (after) sorts.set(id, after);
  });
  return sorts;
};

/** The segments of a path for a chain, with the sort orders of its columns. */
export const segmentsFor = (ids: readonly string[], sorts: Sorts): string[] =>
  ids.map((id, index) => {
    const before = index === 0 ? CODES[sorts.get("influencers") ?? "influence"] : "";
    const after = CODES[sorts.get(id) ?? "influence"];
    return `${before ? `${before}:` : ""}${id}${after ? `:${after}` : ""}`;
  });

/** The people in a sort order; people without a known birth year go last. */
export const sortPeople = (people: readonly PersonSummary[], order: SortOrder) => {
  if (order === "influence") return people;
  if (order === "name") return people.toSorted((a, b) => a.name.localeCompare(b.name, "en"));
  const born = (person: PersonSummary) =>
    (person.birthDate && yearOf(person.birthDate)) ?? Number.POSITIVE_INFINITY;
  return people.toSorted((a, b) => born(a) - born(b));
};
