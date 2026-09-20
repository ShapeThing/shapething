import type { NamedNode, Quad_Object, Quad_Subject } from "@rdfjs/types";
import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { addMissingShapes, mergeFacetTextSearchProperties } from "@/preprocess/shapes.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, rdf, rdfs, sh, st, xsd } from "@/helpers/namespaces.ts";
import { getRdfList, rebuildRdfList } from "@/helpers/rdfList.ts";

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

test("addMissingShapes - sets sh:nodeKind and sh:datatype when every instance's value for a predicate agrees", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("owner"), ex("alice")));
  dataGraph.addQuad(factory.quad(ex("b"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("b"), ex("name"), factory.literal("Jerry")));
  dataGraph.addQuad(factory.quad(ex("b"), ex("owner"), ex("bob")));
  dataGraph.addQuad(factory.quad(ex("alice"), rdf("type"), ex("Person")));
  dataGraph.addQuad(factory.quad(ex("bob"), rdf("type"), ex("Person")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, enableMissingShapesGeneration: true }),
  );
  const shapesGraph = result.shapesGraph as RdfStore;

  const propertyFor = (predicate: NamedNode): Quad_Subject =>
    shapesGraph
      .getQuads(ex("Cat"), sh("property"))
      .map((quad) => quad.object as Quad_Subject)
      .find((propertyNode) =>
        shapesGraph.getQuads(propertyNode, sh("path"), predicate).length > 0,
      )!;

  const nameProperty = propertyFor(ex("name"));
  expect(shapesGraph.getQuads(nameProperty, sh("nodeKind"), sh("Literal"))).toHaveLength(1);
  expect(shapesGraph.getQuads(nameProperty, sh("datatype"), xsd("string"))).toHaveLength(1);
  expect(shapesGraph.getQuads(nameProperty, sh("class"))).toHaveLength(0);

  const ownerProperty = propertyFor(ex("owner"));
  expect(shapesGraph.getQuads(ownerProperty, sh("nodeKind"), sh("IRI"))).toHaveLength(1);
  expect(shapesGraph.getQuads(ownerProperty, sh("datatype"))).toHaveLength(0);
  expect(shapesGraph.getQuads(ownerProperty, sh("class"), ex("Person"))).toHaveLength(1);
});

test("addMissingShapes - leaves sh:class off a predicate whose IRI values don't all share a common rdf:type", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("owner"), ex("alice")));
  dataGraph.addQuad(factory.quad(ex("b"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("b"), ex("owner"), ex("bob")));
  dataGraph.addQuad(factory.quad(ex("alice"), rdf("type"), ex("Person")));
  dataGraph.addQuad(factory.quad(ex("bob"), rdf("type"), ex("Organization")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, enableMissingShapesGeneration: true }),
  );
  const shapesGraph = result.shapesGraph as RdfStore;

  const ownerProperty = shapesGraph
    .getQuads(ex("Cat"), sh("property"))
    .map((quad) => quad.object as Quad_Subject)
    .find((propertyNode) => shapesGraph.getQuads(propertyNode, sh("path"), ex("owner")).length > 0)!;

  // Still narrowed to sh:nodeKind sh:IRI (both values are IRIs), just not to a single sh:class -
  // alice and bob don't share a common rdf:type, so nothing is asserted about which class either
  // one belongs to.
  expect(shapesGraph.getQuads(ownerProperty, sh("nodeKind"), sh("IRI"))).toHaveLength(1);
  expect(shapesGraph.getQuads(ownerProperty, sh("class"))).toHaveLength(0);
});

test("addMissingShapes - leaves sh:class off a predicate whose IRI values share more than one rdf:type in common", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("owner"), ex("alice")));
  dataGraph.addQuad(factory.quad(ex("b"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("b"), ex("owner"), ex("bob")));
  dataGraph.addQuad(factory.quad(ex("alice"), rdf("type"), ex("Person")));
  dataGraph.addQuad(factory.quad(ex("alice"), rdf("type"), ex("Agent")));
  dataGraph.addQuad(factory.quad(ex("bob"), rdf("type"), ex("Person")));
  dataGraph.addQuad(factory.quad(ex("bob"), rdf("type"), ex("Agent")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, enableMissingShapesGeneration: true }),
  );
  const shapesGraph = result.shapesGraph as RdfStore;

  const ownerProperty = shapesGraph
    .getQuads(ex("Cat"), sh("property"))
    .map((quad) => quad.object as Quad_Subject)
    .find((propertyNode) => shapesGraph.getQuads(propertyNode, sh("path"), ex("owner")).length > 0)!;

  // Both ex:Person and ex:Agent are shared by every value - no single one is picked automatically.
  expect(shapesGraph.getQuads(ownerProperty, sh("class"))).toHaveLength(0);
});

test("addMissingShapes - leaves sh:nodeKind/sh:datatype off a predicate whose values disagree", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("nickname"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("b"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("b"), ex("nickname"), ex("jerry")));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, enableMissingShapesGeneration: true }),
  );
  const shapesGraph = result.shapesGraph as RdfStore;

  const nicknameProperty = shapesGraph
    .getQuads(ex("Cat"), sh("property"))
    .map((quad) => quad.object as Quad_Subject)
    .find((propertyNode) => shapesGraph.getQuads(propertyNode, sh("path"), ex("nickname")).length > 0)!;

  expect(shapesGraph.getQuads(nicknameProperty, sh("nodeKind"))).toHaveLength(0);
  expect(shapesGraph.getQuads(nicknameProperty, sh("datatype"))).toHaveLength(0);
});

test("addMissingShapes - sets sh:nodeKind but not sh:datatype when literal values agree on kind but not on datatype", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("age"), factory.literal("3")));
  dataGraph.addQuad(factory.quad(ex("b"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("b"), ex("age"), factory.literal("4", xsd("integer"))));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, enableMissingShapesGeneration: true }),
  );
  const shapesGraph = result.shapesGraph as RdfStore;

  const ageProperty = shapesGraph
    .getQuads(ex("Cat"), sh("property"))
    .map((quad) => quad.object as Quad_Subject)
    .find((propertyNode) => shapesGraph.getQuads(propertyNode, sh("path"), ex("age")).length > 0)!;

  expect(shapesGraph.getQuads(ageProperty, sh("nodeKind"), sh("Literal"))).toHaveLength(1);
  expect(shapesGraph.getQuads(ageProperty, sh("datatype"))).toHaveLength(0);
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

test("addMissingShapes - tops up an explicit sh:targetClass shape with only the predicates it's missing, onto the same shape node", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("age"), factory.literal("3")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("CatShape"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("targetClass"), ex("Cat")));
  const nameProperty = factory.blankNode();
  shapesGraph.addQuad(factory.quad(nameProperty, sh("path"), ex("name")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("property"), nameProperty));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  // The already-declared "name" property is untouched (still the very same blank node, not
  // duplicated), "age" was added onto the existing CatShape node, and no second (implicit-class-
  // shape) shape was minted for the class itself.
  const properties = resultShapesGraph.getQuads(ex("CatShape"), sh("property"));
  expect(properties).toHaveLength(2);
  expect(properties.some((quad) => quad.object.equals(nameProperty))).toBe(true);

  const paths = properties
    .flatMap((quad) => resultShapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);
  expect(new Set(paths)).toEqual(new Set([ex("name").value, ex("age").value]));

  expect(resultShapesGraph.getQuads(null, sh("targetClass"), ex("Cat"))).toHaveLength(1);
  expect(resultShapesGraph.getQuads(ex("Cat"), rdf("type"), sh("NodeShape"))).toHaveLength(0);
});

test("addMissingShapes - tops up an implicit class-shape (sh:NodeShape + rdfs:Class) with missing predicates, onto the class IRI itself", async () => {
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
  const paths = resultShapesGraph
    .getQuads(ex("Cat"), sh("property"))
    .flatMap((quad) => resultShapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);
  expect(paths).toEqual([ex("name").value]);
});

test("addMissingShapes - does nothing at all once a shape already declares every predicate its instances use", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("CatShape"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("targetClass"), ex("Cat")));
  const nameProperty = factory.blankNode();
  shapesGraph.addQuad(factory.quad(nameProperty, sh("path"), ex("name")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("property"), nameProperty));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  expect(resultShapesGraph.getQuads(ex("CatShape"), sh("property"))).toHaveLength(1);
  expect(resultShapesGraph.getQuads(ex("CatShape"), sh("property"))[0]!.object.equals(nameProperty)).toBe(true);
});

test("addMissingShapes - covers a second, unshaped class found in the same data graph while topping up the already-shaped one", async () => {
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

  const catPaths = resultShapesGraph
    .getQuads(ex("CatShape"), sh("property"))
    .flatMap((quad) => resultShapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);
  expect(catPaths).toEqual([ex("name").value]);

  expect(resultShapesGraph.getQuads(ex("Dog"), rdf("type"), sh("NodeShape"))).toHaveLength(1);
  const dogPaths = resultShapesGraph
    .getQuads(ex("Dog"), sh("property"))
    .flatMap((quad) => resultShapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);
  expect(dogPaths).toEqual([ex("breed").value]);
});

test("addMissingShapes - never generates a property shape for a predicate listed under sh:ignoredProperties", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("internalId"), factory.literal("42")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("CatShape"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("targetClass"), ex("Cat")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("closed"), factory.literal("true", xsd("boolean"))));
  const ignoredListHead = rebuildRdfList(rdf("nil"), [ex("internalId")], shapesGraph);
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("ignoredProperties"), ignoredListHead as Quad_Object));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  // Only "name" is topped up - "internalId" is deliberately ignored by the shape author, not
  // "still missing", so it must not get a synthesized bare property.
  const paths = resultShapesGraph
    .getQuads(ex("CatShape"), sh("property"))
    .flatMap((quad) => resultShapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);
  expect(paths).toEqual([ex("name").value]);
});

test("addMissingShapes - never generates a property shape for a predicate already reachable through an existing sh:alternativePath branch", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("title"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("age"), factory.literal("3")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("CatShape"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("targetClass"), ex("Cat")));
  const alternativePathListHead = rebuildRdfList(rdf("nil"), [ex("title"), rdfs("label")], shapesGraph);
  const alternativePathNode = factory.blankNode();
  shapesGraph.addQuad(factory.quad(alternativePathNode, sh("alternativePath"), alternativePathListHead as Quad_Object));
  const titleProperty = factory.blankNode();
  shapesGraph.addQuad(factory.quad(titleProperty, sh("path"), alternativePathNode));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("property"), titleProperty));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  // "title" is already reachable via the existing sh:alternativePath's branch, so only "age" is
  // topped up - no redundant bare property shape is minted for "title" alongside it.
  const properties = resultShapesGraph.getQuads(ex("CatShape"), sh("property"));
  expect(properties).toHaveLength(2);
  expect(properties.some((quad) => quad.object.equals(titleProperty))).toBe(true);

  const bareAgeProperty = properties.find((quad) => !quad.object.equals(titleProperty));
  const agePath = resultShapesGraph.getQuads(bareAgeProperty!.object, sh("path"))[0]?.object;
  expect(agePath).toEqual(ex("age"));
});

test("addMissingShapes - never generates a property shape for a predicate already covered by a shape reached via sh:node", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("age"), factory.literal("3")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("CatShape"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("targetClass"), ex("Cat")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("node"), ex("NamedThingShape")));

  shapesGraph.addQuad(factory.quad(ex("NamedThingShape"), rdf("type"), sh("NodeShape")));
  const nameProperty = factory.blankNode();
  shapesGraph.addQuad(factory.quad(nameProperty, sh("path"), ex("name")));
  shapesGraph.addQuad(factory.quad(ex("NamedThingShape"), sh("property"), nameProperty));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  // "name" is only declared on NamedThingShape, reached from CatShape via sh:node - it must not
  // get a redundant bare property minted directly onto CatShape. Only "age" is topped up.
  const paths = resultShapesGraph
    .getQuads(ex("CatShape"), sh("property"))
    .flatMap((quad) => resultShapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);
  expect(paths).toEqual([ex("age").value]);
});

test("addMissingShapes - never generates a property shape for a predicate already covered by a shape reached via sh:and", async () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), rdf("type"), ex("Cat")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Tom")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("age"), factory.literal("3")));

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("CatShape"), rdf("type"), sh("NodeShape")));
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("targetClass"), ex("Cat")));
  const andListHead = rebuildRdfList(rdf("nil"), [ex("NamedThingShape")], shapesGraph);
  shapesGraph.addQuad(factory.quad(ex("CatShape"), sh("and"), andListHead as Quad_Object));

  shapesGraph.addQuad(factory.quad(ex("NamedThingShape"), rdf("type"), sh("NodeShape")));
  const nameProperty = factory.blankNode();
  shapesGraph.addQuad(factory.quad(nameProperty, sh("path"), ex("name")));
  shapesGraph.addQuad(factory.quad(ex("NamedThingShape"), sh("property"), nameProperty));

  const result = await addMissingShapes(
    rawEnvironment({ dataGraph, shapesGraph, enableMissingShapesGeneration: true }),
  );
  const resultShapesGraph = result.shapesGraph as RdfStore;

  const paths = resultShapesGraph
    .getQuads(ex("CatShape"), sh("property"))
    .flatMap((quad) => resultShapesGraph.getQuads(quad.object, sh("path")))
    .map((quad) => quad.object.value);
  expect(paths).toEqual([ex("age").value]);
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
