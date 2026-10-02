import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { resolveReadOnlyGraphs } from "@/preprocess/readOnlyGraphs.ts";

const rawEnvironment = async (shapes: string, overrides: Partial<RawEnvironment> = {}) => {
  const dataGraph = await parseRdf(
    `${queryPrefixes}
    ex:item ex:tag "Asserted" .
    ex:inferred { ex:item ex:tag "Inferred" . }
    ex:other { ex:item ex:tag "Other" . }`,
    "application/trig",
  );
  return {
    ...defaultEnvironment,
    shapesGraph: await parseRdf(`${queryPrefixes}\n${shapes}`, "text/turtle"),
    dataGraph,
    scoresGraph: RdfStore.createDefault(),
    ...overrides,
  } as RawEnvironment;
};

const values = (store: RdfStore | undefined) =>
  store?.getQuads().map((quad) => quad.object.value).sort();

test("resolveReadOnlyGraphs leaves the environment alone without shui:readOnlyGraph", async () => {
  const environment = await rawEnvironment(`ex:config a shui:Configuration .`);
  expect((await resolveReadOnlyGraphs(environment)).readOnlyGraph).toBeUndefined();
});

test("resolveReadOnlyGraphs copies the configured named graphs' triples into readOnlyGraph", async () => {
  const environment = await rawEnvironment(
    `ex:config a shui:Configuration ; shui:readOnlyGraph ( ex:inferred ) .`,
  );
  expect(values((await resolveReadOnlyGraphs(environment)).readOnlyGraph as RdfStore)).toEqual([
    "Inferred",
  ]);
});

test("resolveReadOnlyGraphs keeps a caller-supplied readOnlyGraph alongside, without mutating it", async () => {
  const supplied = RdfStore.createDefault();
  supplied.addQuad(factory.quad(ex("item"), ex("tag"), factory.literal("Supplied")));
  const environment = await rawEnvironment(
    `ex:config a shui:Configuration ; shui:readOnlyGraph ( ex:inferred ex:other ) .`,
    { readOnlyGraph: supplied },
  );
  expect(values((await resolveReadOnlyGraphs(environment)).readOnlyGraph as RdfStore)).toEqual([
    "Inferred",
    "Other",
    "Supplied",
  ]);
  expect(supplied.size).toBe(1);
});
