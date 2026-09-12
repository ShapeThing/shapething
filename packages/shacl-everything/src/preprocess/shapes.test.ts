import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { addMissingShapes, mergeFacetTextSearchProperties } from "@/preprocess/shapes.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, rdf, rdfs, sh, st, xsd } from "@/helpers/namespaces.ts";
import { getRdfList } from "@/helpers/rdfList.ts";

const rawEnvironment = (overrides: Partial<RawEnvironment>): RawEnvironment => ({
  ...defaultEnvironment,
  shapesGraph: RdfStore.createDefault(),
  dataGraph: RdfStore.createDefault(),
  scoresGraph: RdfStore.createDefault(),
  ...overrides,
});

test("addMissingShapes - does nothing unless enableMissingShapesGeneration is on", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));

  const shapesGraph = RdfStore.createDefault();
  const result = await addMissingShapes(rawEnvironment({ dataGraph, shapesGraph }));

  expect(result.shapesGraph).toBe(shapesGraph);
  expect((result.shapesGraph as RdfStore).getQuads()).toHaveLength(0);
});

test("addMissingShapes - mints an implicit class-shape (the class IRI itself) and a property shape per predicate for a wholly unshaped class", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("age"), factory.literal("3")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, enableMissingShapesGeneration: true }),
  );
  const shapesGraph = result.shapesGraph as RdfStore;

  // The generated shape's own subject is the class IRI itself (3.1.3.3 implicit class target),
  // not an opaque blank node - so a caller who already knows the class IRI can reference it
  // directly, e.g. as Environment.nodeShapes.
  expect(shapesGraph.getQuads(ex("Cat"), rdf("type"), sh("NodeShape"))).toHaveLength(1);
  expect(shapesGraph.getQuads(ex("Cat"), rdf("type"), rdfs("Class"))).toHaveLength(1);

  const paths = shapesGraph
    .getQuads(ex("Cat"), sh("property"))
    .flatMap((quad) => shapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);

  expect(new Set(paths)).toEqual(new Set([ex("name").value, ex("age").value]));
});

test("addMissingShapes - never generates a property shape for rdf:type itself", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, enableMissingShapesGeneration: true }),
  );
  const shapesGraph = result.shapesGraph as RdfStore;

  // A class with no other predicates at all gets no generated shape - there'd be nothing for it
  // to say beyond the implicit rdf:type, which every instance already carries by definition.
  expect(shapesGraph.getQuads(ex("Cat"), rdf("type"), sh("NodeShape"))).toHaveLength(0);
});

test("addMissingShapes - leaves a class alone when it already has an explicit sh:targetClass shape, even if that shape is missing properties", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("CatShape"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("targetClass"), ex("Cat")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  // No new sh:property was bolted onto the existing shape, and no second (implicit-class-shape)
  // shape was minted for the class itself.
  expect(resultShapesGraph.getQuads(ex("CatShape"), sh("property"))).toHaveLength(0);
  expect(resultShapesGraph.getQuads(null, sh("targetClass"), ex("Cat"))).toHaveLength(1);
  expect(resultShapesGraph.getQuads(ex("Cat"), rdf("type"), sh("NodeShape"))).toHaveLength(0);
});

test("addMissingShapes - leaves a class alone when it's covered by an implicit class-shape (sh:NodeShape + rdfs:Class)", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), rdfs("Class")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  expect(resultShapesGraph.getQuads(null, sh("targetClass"), ex("Cat"))).toHaveLength(0);
  expect(resultShapesGraph.getQuads(ex("Cat"), sh("property"))).toHaveLength(0);
});

test("addMissingShapes - covers a second, unshaped class found in the same data graph while leaving the shaped one untouched", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("b"), rdf("type"), ex("Dog")));
  dataGraph.addQuad(factory.quad(ex("b"), ex("breed"), factory.literal("Labrador")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("CatShape"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("targetClass"), ex("Cat")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  expect(resultShapesGraph.getQuads(ex("CatShape"), sh("property"))).toHaveLength(0);

  expect(resultShapesGraph.getQuads(ex("Dog"), rdf("type"), sh("NodeShape"))).toHaveLength(1);
  const dogPaths = resultShapesGraph
    .getQuads(ex("Dog"), sh("property"))
    .flatMap((quad) => resultShapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);
  expect(dogPaths).toEqual([ex("breed").value]);
});

test("addMissingShapes - does not mutate the caller-supplied shapesGraph in place", () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));

  const shapesGraph = RdfStore.createDefault();
  addMissingShapes(rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }));

  expect(shapesGraph.getQuads()).toHaveLength(0);
});

const facetEnvironment = (overrides: Partial<RawEnvironment>): RawEnvironment =>
  rawEnvironment({ mode: "facet", enableFacetTextSearchMerging: true, ...overrides });

test("mergeFacetTextSearchProperties - does nothing unless mode is facet and enableFacetTextSearchMerging is on", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), rdfs("Class")));

  const notFacetMode = await mergeFacetTextSearchProperties(
    rawEnvironment({ dataGraph, shapesGraph, mode: "edit", enableFacetTextSearchMerging: true }),
  );
  expect((notFacetMode.shapesGraph as RdfStore).getQuads(ex("Cat"), sh("property"))).toHaveLength(0);

  const flagOff = await mergeFacetTextSearchProperties(facetEnvironment({ dataGraph, shapesGraph, enableFacetTextSearchMerging: false }));
  expect((flagOff.shapesGraph as RdfStore).getQuads(ex("Cat"), sh("property"))).toHaveLength(0);
});

// Builds a bare sh:property [ sh:path predicate ; sh:datatype datatype ] node under `rootShape` and
// returns it, for the tests below to layer st:facet onto selectively.
function addTextProperty(
  shapesGraph: RdfStore,
  rootShape: Quad_Subject,
  predicate: NamedNode,
  datatype: NamedNode,
) {
  const propertyNode = factory.blankNode();
  shapesGraph.addQuad(factory.quad(propertyNode, sh("path"), predicate));
  shapesGraph.addQuad(factory.quad(propertyNode, sh("datatype"), datatype));
  shapesGraph.addQuad(factory.quad(rootShape, sh("property"), propertyNode));
  return propertyNode;
}

test("mergeFacetTextSearchProperties - merges every sh:datatype xsd:string/rdf:langString property with no st:facet of its own into one sh:alternativePath text search property", async () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), rdfs("Class")));
  addTextProperty(shapesGraph, ex("Cat"), ex("name"), xsd("string"));
  addTextProperty(shapesGraph, ex("Cat"), ex("bio"), rdf("langString"));
  // A non-text property, left alone regardless.
  const ageProperty = factory.blankNode();
  shapesGraph.addQuad(factory.quad(ageProperty, sh("path"), ex("age")));
  shapesGraph.addQuad(factory.quad(ageProperty, sh("datatype"), xsd("integer")));
  shapesGraph.addQuad(factory.quad(ex("Cat"), sh("property"), ageProperty));

  const result = await mergeFacetTextSearchProperties(facetEnvironment({ shapesGraph }));
  const resultShapesGraph = result.shapesGraph as RdfStore;

  const properties = resultShapesGraph.getQuads(ex("Cat"), sh("property")).map((quad) => quad.object);
  // name/bio were unlinked from the shape and replaced by one generated property; age is untouched.
  expect(properties).toHaveLength(2);
  expect(properties.some((property) => property.equals(ageProperty))).toBe(true);

  const generatedProperty = properties.find((property) => !property.equals(ageProperty));
  if (!generatedProperty) throw new Error("expected a generated text search property");

  expect(
    resultShapesGraph.getQuads(generatedProperty, st("facet"), st("TextSearchFacet")),
  ).toHaveLength(1);

  const pathNode = resultShapesGraph.getQuads(generatedProperty, sh("path"))[0]?.object;
  if (!pathNode) throw new Error("expected the generated property to have an sh:path");
  const alternativePathListHead = resultShapesGraph.getQuads(pathNode, sh("alternativePath"))[0]?.object;
  if (!alternativePathListHead) throw new Error("expected sh:path to be an sh:alternativePath");
  const mergedPredicates = getRdfList(alternativePathListHead, resultShapesGraph).map((term) => term.value);

  expect(new Set(mergedPredicates)).toEqual(new Set([ex("name").value, ex("bio").value]));
});

test("mergeFacetTextSearchProperties - leaves a property alone (never folds it in) once it already has its own st:facet, even when it's xsd:string", async () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), rdfs("Class")));

  const colorProperty = addTextProperty(shapesGraph, ex("Cat"), ex("color"), xsd("string"));
  shapesGraph.addQuad(factory.quad(colorProperty, st("facet"), st("CategoryFacet")));

  addTextProperty(shapesGraph, ex("Cat"), ex("name"), xsd("string"));

  const result = await mergeFacetTextSearchProperties(facetEnvironment({ shapesGraph }));
  const resultShapesGraph = result.shapesGraph as RdfStore;

  const properties = resultShapesGraph.getQuads(ex("Cat"), sh("property")).map((quad) => quad.object);
  // colorProperty (already faceted) stays linked as-is; name was folded into a new generated
  // property - two properties total, not three, and not zero.
  expect(properties).toHaveLength(2);
  expect(properties.some((property) => property.equals(colorProperty))).toBe(true);
  expect(resultShapesGraph.getQuads(colorProperty, st("facet"), st("CategoryFacet"))).toHaveLength(1);
});

test("mergeFacetTextSearchProperties - does nothing when every property already has its own st:facet", async () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), rdfs("Class")));

  const colorProperty = addTextProperty(shapesGraph, ex("Cat"), ex("color"), xsd("string"));
  shapesGraph.addQuad(factory.quad(colorProperty, st("facet"), st("TextSearchFacet")));

  const result = await mergeFacetTextSearchProperties(facetEnvironment({ shapesGraph }));
  const resultShapesGraph = result.shapesGraph as RdfStore;

  expect(resultShapesGraph.getQuads(ex("Cat"), sh("property"))).toHaveLength(1);
  expect(resultShapesGraph.getQuads(ex("Cat"), sh("property"))[0]!.object.equals(colorProperty)).toBe(true);
});

test("mergeFacetTextSearchProperties - does not mutate the caller-supplied shapesGraph in place", () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("Cat"), rdf("type"), rdfs("Class")));
  addTextProperty(shapesGraph, ex("Cat"), ex("name"), xsd("string"));

  const originalQuadCount = shapesGraph.getQuads().length;
  mergeFacetTextSearchProperties(facetEnvironment({ shapesGraph }));

  expect(shapesGraph.getQuads()).toHaveLength(originalQuadCount);
});
