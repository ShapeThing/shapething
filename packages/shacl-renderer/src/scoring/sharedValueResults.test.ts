import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { ex, rdf, xsd } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { cachedValidate } from "@/scoring/helpers.ts";

// Shapes standing in for a scoring graph's data graph shapes: two that only look at the value
// (shared across data graphs) and one that reads the data graph (sh:class - never shared).
const scoring = await parseRdf(
  `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix ex: <http://example.org/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  ex:isDate a sh:NodeShape ; sh:datatype xsd:date .
  ex:isIRIOrDate a sh:NodeShape ; sh:or ( [ sh:nodeKind sh:IRI ] [ sh:datatype xsd:date ] ) .
  ex:isThing a sh:NodeShape ; sh:class ex:Thing .
`,
  "text/turtle",
);

const check = (
  focusNode: Parameters<typeof cachedValidate>[0]["focusNode"],
  shape: string,
  data: RdfStore,
) => cachedValidate({ focusNode, targetGraph: data, shapeNode: ex(shape), shapesGraph: scoring });

test("a data-reading shape is still answered per data graph", async () => {
  const withType = RdfStore.createDefault();
  withType.addQuad(factory.quad(ex("x"), rdf("type"), ex("Thing")));
  const withoutType = RdfStore.createDefault();
  expect(await check(ex("x"), "isThing", withType)).toBe(true);
  expect(await check(ex("x"), "isThing", withoutType)).toBe(false);
});

test("a kind/datatype-only shape distinguishes well-formed from ill-formed literals", async () => {
  const data = RdfStore.createDefault();
  expect(await check(factory.literal("2024-01-02", xsd("date")), "isDate", data)).toBe(true);
  expect(await check(factory.literal("not a date", xsd("date")), "isDate", data)).toBe(false);
  expect(
    await check(factory.literal("2025-03-04", xsd("date")), "isDate", RdfStore.createDefault()),
  ).toBe(true);
  expect(await check(factory.literal("2024-01-02"), "isDate", data)).toBe(false);
});

test("a kind-only shape answers every IRI alike, across data graphs", async () => {
  expect(await check(ex("a"), "isIRIOrDate", RdfStore.createDefault())).toBe(true);
  expect(await check(ex("b"), "isIRIOrDate", RdfStore.createDefault())).toBe(true);
  expect(await check(factory.blankNode(), "isIRIOrDate", RdfStore.createDefault())).toBe(false);
});
