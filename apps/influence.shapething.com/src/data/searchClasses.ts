/**
 * What the search of the homepage can look for: things with influences on Wikidata ("influenced
 * by", P737). A few kinds of people, by occupation (P106), and the two other classes with many
 * influences: musical groups and programming languages. Classes like films, literary works and
 * music genres are linked otherwise on Wikidata (based on, inspired by, subclass of) and give poor
 * chains with P737 alone.
 *
 * The search query (queries/search.rq) keeps the things with the class or occupation, or a kind of
 * it (a rock band is a kind of musical group, a physicist a kind of scientist). The full-text
 * search can only filter on a direct value (haswbstatement, see data/queries.ts): a class whose
 * instances mostly have a kind of it (the programming languages are "object-based languages",
 * "functional programming languages" and the like) has none, and the query filters.
 */
export type SearchClass = {
  /** The Wikidata identifier of the class or occupation. */
  id: string;
  /** In the selector, plural: "Philosophers". */
  label: string;
  /** How a thing has it: an instance of the class (P31, the default) or an occupation (P106). */
  property?: "P31" | "P106";
  /** The values the things mostly have directly, for the full-text search. */
  directClasses?: readonly string[];
  /**
   * Three well known ones to try, under the search. Chosen by hand: the most influential on
   * Wikidata are odd examples (David Bowie is a painter there, Karl Marx a writer and a scientist).
   */
  examples: readonly [Example, Example, Example];
};

/** A Wikidata identifier and the name to show. */
export type Example = { id: string; name: string };

export const SEARCH_CLASSES: readonly SearchClass[] = [
  {
    id: "Q4964182",
    label: "Philosophers",
    property: "P106",
    directClasses: ["Q4964182"],
    examples: [
      { id: "Q6512", name: "Søren Kierkegaard" },
      { id: "Q859", name: "Plato" },
      { id: "Q9358", name: "Friedrich Nietzsche" },
    ],
  },
  // Writers, novelists, poets, playwrights and essayists.
  {
    id: "Q36180",
    label: "Writers",
    property: "P106",
    directClasses: ["Q36180", "Q6625963", "Q49757", "Q214917", "Q11774202"],
    examples: [
      { id: "Q692", name: "William Shakespeare" },
      { id: "Q905", name: "Franz Kafka" },
      { id: "Q40909", name: "Virginia Woolf" },
    ],
  },
  {
    id: "Q1028181",
    label: "Painters",
    property: "P106",
    directClasses: ["Q1028181"],
    examples: [
      { id: "Q35548", name: "Paul Cézanne" },
      { id: "Q5593", name: "Pablo Picasso" },
      { id: "Q5598", name: "Rembrandt" },
    ],
  },
  {
    id: "Q36834",
    label: "Composers",
    property: "P106",
    directClasses: ["Q36834"],
    examples: [
      { id: "Q1339", name: "Johann Sebastian Bach" },
      { id: "Q255", name: "Ludwig van Beethoven" },
      { id: "Q4700", name: "Claude Debussy" },
    ],
  },
  // Scientists, physicists, chemists, mathematicians, biologists and astronomers.
  {
    id: "Q901",
    label: "Scientists",
    property: "P106",
    directClasses: ["Q901", "Q169470", "Q593644", "Q170790", "Q864503", "Q11063"],
    examples: [
      { id: "Q1035", name: "Charles Darwin" },
      { id: "Q935", name: "Isaac Newton" },
      { id: "Q937", name: "Albert Einstein" },
    ],
  },
  // Musical groups, rock bands, punk bands and duos.
  {
    id: "Q215380",
    label: "Bands",
    directClasses: ["Q215380", "Q5741069", "Q25391823", "Q9212979"],
    examples: [
      { id: "Q1299", name: "The Beatles" },
      { id: "Q2331", name: "Led Zeppelin" },
      { id: "Q11649", name: "Nirvana" },
    ],
  },
  {
    id: "Q9143",
    label: "Programming languages",
    examples: [
      { id: "Q15777", name: "C" },
      { id: "Q132874", name: "Lisp" },
      { id: "Q235086", name: "Smalltalk" },
    ],
  },
];

export const DEFAULT_SEARCH_CLASS = SEARCH_CLASSES[0];

const STORAGE_KEY = "searchClass";

/**
 * The class searched for last in this tab (sessionStorage), so going back to the homepage keeps
 * it; else philosophers.
 */
export const storedSearchClass = (): SearchClass => {
  try {
    const id = sessionStorage.getItem(STORAGE_KEY);
    return SEARCH_CLASSES.find((searchClass) => searchClass.id === id) ?? DEFAULT_SEARCH_CLASS;
  } catch {
    return DEFAULT_SEARCH_CLASS;
  }
};

export const storeSearchClass = (searchClass: SearchClass) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, searchClass.id);
  } catch {
    // Without storage (private browsing) the class is not kept.
  }
};
