import { DataFactory } from "rdf-data-factory";
import { expect, test } from "vite-plus/test";
import {
  endOf,
  entityFromRows,
  type EntityRow,
  itemListsFromRows,
  summariesFromRows,
  startOf,
  summarize,
} from "./person.ts";

const factory = new DataFactory();
const wd = (id: string) => factory.namedNode(`http://www.wikidata.org/entity/${id}`);
const integer = (value: number) =>
  factory.literal(String(value), factory.namedNode("http://www.w3.org/2001/XMLSchema#integer"));
const bool = (value: boolean) =>
  factory.literal(String(value), factory.namedNode("http://www.w3.org/2001/XMLSchema#boolean"));

test("a summary takes each value from the first row that has one", () => {
  const summary = summarize(wd("Q859"), [
    { influence: integer(12), mulName: factory.literal("Platon", "mul") },
    { influence: integer(12), name: factory.literal("Plato", "en"), image: wd("image") },
  ]);
  expect(summary.id).toBe("Q859");
  expect(summary.name).toBe("Plato");
  expect(summary.image?.value).toBe(wd("image").value);
  expect(summary.influence).toBe(12);
});

test("without a label the name is the identifier", () => {
  expect(summarize(wd("Q1"), [{ influence: integer(0) }]).name).toBe("Q1");
});

test("the rows are grouped by item, in the order of the query", () => {
  const summaries = summariesFromRows([
    { item: wd("Q2"), influence: integer(3) },
    { item: wd("Q1"), influence: integer(2) },
    { item: wd("Q2"), influence: integer(3) },
  ]);
  expect(summaries.map((summary) => summary.id)).toEqual(["Q2", "Q1"]);
});

const entityRow = (row: Partial<EntityRow>): EntityRow => ({
  influence: integer(0),
  isPerson: bool(false),
  hasAuthor: bool(false),
  ...row,
});

const dateTime = (value: string) =>
  factory.literal(value, factory.namedNode("http://www.w3.org/2001/XMLSchema#dateTime"));

test("a band has the dates it was formed and broke up, its start and end", () => {
  const band = summarize(wd("Q1299"), [
    {
      influence: integer(0),
      inception: dateTime("1960-01-01T00:00:00Z"),
      dissolved: dateTime("1970-04-10T00:00:00Z"),
    },
  ]);
  expect(startOf(band)?.value).toBe("1960-01-01T00:00:00Z");
  expect(endOf(band)?.value).toBe("1970-04-10T00:00:00Z");
});

test("the years at the end of a person's or a band's description are left out", () => {
  const description = factory.literal("English pop rock band (1960–1970)", "en");
  const band = entityFromRows(wd("Q1299"), [entityRow({ isPerson: bool(true), description })]);
  expect(band.description?.value).toBe("English pop rock band");
  expect(band.description?.language).toBe("en");
  // A work keeps its description as it is.
  const work = entityFromRows(wd("Q1"), [entityRow({ hasAuthor: bool(true), description })]);
  expect(work.description?.value).toBe("English pop rock band (1960–1970)");
});

test("the kind of an entity: a person, a work or a concept", () => {
  expect(entityFromRows(wd("Q1"), [entityRow({ isPerson: bool(true) })]).kind).toBe("person");
  expect(entityFromRows(wd("Q1"), [entityRow({ hasAuthor: bool(true) })]).kind).toBe("work");
  expect(entityFromRows(wd("Q1"), [entityRow({})]).kind).toBe("concept");
});

test("the demonym of a country is the one qualified as adjective", () => {
  const denmark = { citizenship: wd("Q35"), flag: wd("flag") };
  const entity = entityFromRows(wd("Q6512"), [
    entityRow({ ...denmark, demonym: factory.literal("Dane", "en") }),
    entityRow({
      ...denmark,
      demonym: factory.literal("Danish", "en"),
      demonymIsAdjective: bool(true),
    }),
  ]);
  expect(entity.citizenships).toHaveLength(1);
  expect(entity.citizenships[0].demonym?.value).toBe("Danish");
});

test("without an adjective, the one that ends like an adjective is used", () => {
  const demonymFrom = (...values: string[]) =>
    entityFromRows(
      wd("Q1"),
      values.map((value) =>
        entityRow({
          citizenship: wd("Q865"),
          citizenshipName: factory.literal("Taiwan", "en"),
          flag: wd("flag"),
          demonym: factory.literal(value, "en"),
        }),
      ),
    ).citizenships[0].demonym?.value;
  expect(demonymFrom("Briton", "British")).toBe("British");
  expect(demonymFrom("Spaniard", "Spanish")).toBe("Spanish");
  expect(demonymFrom("Finn", "Finnish")).toBe("Finnish");
  expect(demonymFrom("Aussies", "Aussie", "Australians", "Australian")).toBe("Australian");
  expect(demonymFrom("taiwanese", "Taiwanese", "Taiwan")).toBe("Taiwanese");
  // Neither ends like an adjective: the first in alphabetical order.
  expect(demonymFrom("Mosotho", "Basotho")).toBe("Basotho");
});

test("without an adjective, the plural of another demonym is left out", () => {
  const brazil = { citizenship: wd("Q155"), flag: wd("flag") };
  const entity = entityFromRows(wd("Q1"), [
    entityRow({ ...brazil, demonym: factory.literal("Brazilians", "en") }),
    entityRow({ ...brazil, demonym: factory.literal("Brazilian", "en") }),
  ]);
  expect(entity.citizenships[0].demonym?.value).toBe("Brazilian");
});

test("the items are listed by their kind, each once, an unknown kind left out", () => {
  const row = (kind: string, id: string, musicBrainzId?: string) => ({
    kind: factory.literal(kind),
    item: wd(id),
    name: factory.literal(id, "en"),
    musicBrainzId: musicBrainzId ? factory.literal(musicBrainzId) : undefined,
  });
  const lists = itemListsFromRows([
    row("albums", "Q173643"),
    row("albums", "Q173643", "9162580e"),
    row("artworks", "Q45585"),
    row("songs", "Q1"),
  ]);
  expect(lists.albums.map((album) => album.musicBrainzId?.value)).toEqual(["9162580e"]);
  expect(lists.artworks.map((artwork) => artwork.iri.value)).toEqual([wd("Q45585").value]);
  expect(lists.works).toEqual([]);
});
