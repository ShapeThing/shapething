import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { getRdfList } from "@/helpers/rdfList.ts";
import { ex, geosparql, queryPrefixes, rdf, sh, st, xsd } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import {
  createFilterShape,
  findFilterConstraintNode,
  getFilterConstraintNode,
  pathSparqlFor,
  readFilterConstraint,
  removeFilterConstraintsForPaths,
  setFilterConstraint,
  setFilterConstraintForProperty,
  setFilterConstraintsForProperty,
  type FilterShape,
} from "@/facets/filterShape.ts";
import { instancesMatchingFilterShape } from "@/facets/facetQueries.ts";
import { sparqlEndpointFetch } from "@/facets/testing/sparqlEndpointShim.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

// Value-level constraints (sh:in, sh:pattern, the range bounds) live inside the constraint node's
// sh:qualifiedValueShape - this returns the quads for `predicate` wherever they physically live.
function valueQuads(filterShape: FilterShape, node: Quad_Subject, predicate: Parameters<typeof sh>[0]) {
  const qualified = filterShape.store.getQuads(node, sh("qualifiedValueShape"))[0]?.object as
    | Quad_Subject
    | undefined;
  return qualified ? filterShape.store.getQuads(qualified, sh(predicate)) : [];
}

// Runs the filter both against the local store and through a SPARQL endpoint (the fetch shim
// serving the same store over the SPARQL protocol) - the two must always agree.
async function matching(
  filterShape: FilterShape,
  dataGraph: RdfStore,
  shapesGraph: RdfStore,
  candidates: Term[],
): Promise<string[]> {
  const local = await instancesMatchingFilterShape(filterShape, candidates, {
    source: { kind: "local", store: dataGraph },
    shapesGraph,
  });
  const endpoint = await instancesMatchingFilterShape(filterShape, candidates, {
    source: { kind: "endpoint", url: "http://endpoint.test/sparql" },
    shapesGraph,
    queryOptions: { fetch: sparqlEndpointFetch(dataGraph) },
  });
  const localValues = local.map((instance) => instance.value).sort();
  expect(endpoint.map((instance) => instance.value).sort()).toEqual(localValues);
  return localValues;
}

async function propertyFor(pathTurtle: string) {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${pathTurtle}`, "text/turtle");
  const dataGraph = await parseRdf("", "text/turtle");
  return new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
}

test("createFilterShape: mints a fresh urn:uuid: root IRI when none is given", () => {
  const a = createFilterShape();
  const b = createFilterShape();

  expect(a.rootNode.termType).toBe("NamedNode");
  expect(a.rootNode.value).toMatch(/^urn:uuid:/);
  // Every session gets its own identity, not a shared/fixed placeholder.
  expect(a.rootNode.equals(b.rootNode)).toBe(false);
});

test("createFilterShape: uses a given root IRI (e.g. Environment.focusNode) as the shape's own identity", () => {
  const filterShape = createFilterShape(ex("myFilterShape"));

  expect(filterShape.rootNode.equals(ex("myFilterShape"))).toBe(true);
  expect(filterShape.store.getQuads(ex("myFilterShape"), rdf("type"), sh("NodeShape")).length).toBe(
    1,
  );
});

test("getFilterConstraintNode: auto-vivifies a sh:property entry with a copied sh:path", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:age .`);
  const filterShape = createFilterShape();

  const node = getFilterConstraintNode(filterShape, property);

  expect(
    filterShape.store
      .getQuads(filterShape.rootNode, sh("property"))
      .map((quad) => quad.object.value),
  ).toEqual([node.value]);
  expect(filterShape.store.getQuads(node, sh("path"))[0]?.object.value).toEqual(ex("age").value);
});

test("getFilterConstraintNode: a second call for the same path reuses the same node", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:age .`);
  const filterShape = createFilterShape();

  const first = getFilterConstraintNode(filterShape, property);
  const second = getFilterConstraintNode(filterShape, property);

  expect(second.equals(first)).toBe(true);
  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property")).length).toBe(1);
});

test("getFilterConstraintNode: different paths get different nodes", async () => {
  const ageProperty = await propertyFor(`ex:property1 sh:path ex:age .`);
  const nameProperty = await propertyFor(`ex:property1 sh:path ex:name .`);
  const filterShape = createFilterShape();

  const ageNode = getFilterConstraintNode(filterShape, ageProperty);
  const nameNode = getFilterConstraintNode(filterShape, nameProperty);

  expect(ageNode.equals(nameNode)).toBe(false);
  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property")).length).toBe(2);
});

test("setFilterConstraint: writes, replaces, and removes a plain single value", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:age .`);
  const filterShape = createFilterShape();
  const node = getFilterConstraintNode(filterShape, property);

  setFilterConstraint(filterShape, node, sh("minInclusive"), factory.literal("10", xsd("integer")));
  expect(valueQuads(filterShape, node, "minInclusive")[0]?.object.value).toEqual("10");

  setFilterConstraint(filterShape, node, sh("minInclusive"), factory.literal("20", xsd("integer")));
  expect(
    valueQuads(filterShape, node, "minInclusive").map((quad) => quad.object.value),
  ).toEqual(["20"]);

  setFilterConstraint(filterShape, node, sh("minInclusive"), undefined);
  expect(valueQuads(filterShape, node, "minInclusive")).toEqual([]);
});

test("setFilterConstraint: writes a multi-valued constraint as a fresh SHACL list", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:type .`);
  const filterShape = createFilterShape();
  const node = getFilterConstraintNode(filterShape, property);

  setFilterConstraint(filterShape, node, sh("in"), [ex("Cat"), ex("Dog")]);

  const listHead = valueQuads(filterShape, node, "in")[0]?.object;
  expect(listHead).toBeDefined();
  expect(getRdfList(listHead!, filterShape.store).map((term) => term.value)).toEqual([
    ex("Cat").value,
    ex("Dog").value,
  ]);
});

test("setFilterConstraint: clearing a facet's only constraint prunes the whole sh:property entry", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:category .`);
  const filterShape = createFilterShape();
  const node = getFilterConstraintNode(filterShape, property);

  setFilterConstraint(filterShape, node, sh("in"), [ex("Electronics")]);
  setFilterConstraint(filterShape, node, sh("in"), undefined);

  // No vacuous sh:property [ sh:path ... ] left behind once the last value is cleared - a facet
  // rendered but never given input, or given input and then cleared back out, look identical.
  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property"))).toEqual([]);
  expect(filterShape.store.getQuads(node)).toEqual([]);
});

test("setFilterConstraint: clearing one of two constraints on the same node keeps the node", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:price .`);
  const filterShape = createFilterShape();
  const node = getFilterConstraintNode(filterShape, property);

  setFilterConstraint(filterShape, node, sh("minInclusive"), factory.literal("10", xsd("integer")));
  setFilterConstraint(filterShape, node, sh("maxInclusive"), factory.literal("20", xsd("integer")));
  setFilterConstraint(filterShape, node, sh("minInclusive"), undefined);

  // maxInclusive is still set, so the sh:property entry must survive.
  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property")).length).toBe(1);
  expect(filterShape.store.getQuads(node, sh("path")).length).toBe(1);
  expect(valueQuads(filterShape, node, "maxInclusive")[0]?.object.value).toEqual("20");
});

test("setFilterConstraint: clearing a list-valued constraint deletes the old list's own cells", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:type .`);
  const filterShape = createFilterShape();
  const node = getFilterConstraintNode(filterShape, property);

  setFilterConstraint(filterShape, node, sh("in"), [ex("Cat"), ex("Dog")]);
  const listHead = valueQuads(filterShape, node, "in")[0]?.object;

  setFilterConstraint(filterShape, node, sh("in"), undefined);

  // Not just the constraintNode -> sh:in -> listHead link: the list's own rdf:first/rdf:rest
  // cells must be gone too, not orphaned in the store forever.
  expect(getRdfList(listHead!, filterShape.store)).toEqual([]);
  expect(filterShape.store.getQuads(null, rdf("first"))).toEqual([]);
});

test("setFilterConstraint: rewriting a list-valued constraint cleans up the old list's cells", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:type .`);
  const filterShape = createFilterShape();
  const node = getFilterConstraintNode(filterShape, property);

  setFilterConstraint(filterShape, node, sh("in"), [ex("Cat"), ex("Dog"), ex("Bird")]);
  setFilterConstraint(filterShape, node, sh("in"), [ex("Cat")]);

  const listHead = valueQuads(filterShape, node, "in")[0]?.object;
  expect(getRdfList(listHead!, filterShape.store).map((term) => term.value)).toEqual([
    ex("Cat").value,
  ]);
  // Exactly one sh:in triple should remain pointing at the (rebuilt) list.
  expect(valueQuads(filterShape, node, "in").length).toBe(1);
});

test("setFilterConstraintForProperty: a brand-new node's own value is visible to a wildcard subscriber the moment it's linked in, not one write later", async () => {
  // Reproduces exactly what useReactiveRead does: a sibling facet subscribes to the wildcard
  // "something was added under rootNode's sh:property" pattern, the same way every FacetPropertyComponent
  // does, to notice a brand-new constraint appearing anywhere. Before setFilterConstraintForProperty
  // existed, getFilterConstraintNode linked a still-empty node in *before* setFilterConstraint wrote
  // its value - so this exact subscriber would have observed (and, under React's
  // useSyncExternalStore, permanently cached) a property with no value yet. A checkbox/search box/
  // number range never reflecting its own first input was the real, user-visible symptom.
  const property = await propertyFor(`ex:property1 sh:path ex:category .`);
  const filterShape = createFilterShape();
  const reactivity = getReactivity(filterShape.store)!;

  const { patterns } = reactivity.track(() => {
    filterShape.store.getQuads(filterShape.rootNode, sh("property"));
  });

  let valuesSeenAtNotifyTime: string[] | undefined;
  reactivity.subscribe(patterns, () => {
    const node = findFilterConstraintNode(filterShape, property);
    const listHead = node ? valueQuads(filterShape, node, "in")[0]?.object : undefined;
    valuesSeenAtNotifyTime = listHead
      ? getRdfList(listHead, filterShape.store).map((term) => term.value)
      : undefined;
  });

  setFilterConstraintForProperty(filterShape, property, sh("in"), [ex("Electronics")]);

  expect(valuesSeenAtNotifyTime).toEqual([ex("Electronics").value]);
});

test("setFilterConstraintForProperty: routes to the ordinary find-and-write path once a node already exists", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:category .`);
  const filterShape = createFilterShape();

  setFilterConstraintForProperty(filterShape, property, sh("in"), [ex("Electronics")]);
  setFilterConstraintForProperty(filterShape, property, sh("in"), [ex("Electronics"), ex("Books")]);

  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property")).length).toBe(1);
  const node = findFilterConstraintNode(filterShape, property)!;
  const listHead = valueQuads(filterShape, node, "in")[0]?.object;
  expect(getRdfList(listHead!, filterShape.store).map((term) => term.value)).toEqual([
    ex("Electronics").value,
    ex("Books").value,
  ]);
});

test("setFilterConstraintForProperty: clearing with nothing to clear is a no-op", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:category .`);
  const filterShape = createFilterShape();

  setFilterConstraintForProperty(filterShape, property, sh("in"), undefined);

  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property"))).toEqual([]);
});

test("removeFilterConstraintsForPaths: drops only the constraints whose path is in the given set", async () => {
  const ageProperty = await propertyFor(`ex:property1 sh:path ex:age .`);
  const nameProperty = await propertyFor(`ex:property1 sh:path ex:name .`);
  const filterShape = createFilterShape();
  const ageNode = getFilterConstraintNode(filterShape, ageProperty);
  const nameNode = getFilterConstraintNode(filterShape, nameProperty);
  setFilterConstraint(
    filterShape,
    ageNode,
    sh("minInclusive"),
    factory.literal("10", xsd("integer")),
  );
  setFilterConstraint(filterShape, nameNode, sh("in"), [ex("Alice"), ex("Bob")]);

  removeFilterConstraintsForPaths(filterShape, new Set([pathSparqlFor(ageProperty)!]));

  // The stale (age) constraint - and its own triples - are gone...
  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property")).length).toBe(1);
  expect(filterShape.store.getQuads(ageNode).length).toBe(0);
  expect(filterShape.store.getQuads(null, sh("minInclusive")).length).toBe(0);
  // ...but the surviving (name) constraint, including its sh:in list, is untouched.
  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property"))[0]?.object.value).toEqual(
    nameNode.value,
  );
  const listHead = valueQuads(filterShape, nameNode, "in")[0]?.object;
  expect(getRdfList(listHead!, filterShape.store).map((term) => term.value)).toEqual([
    ex("Alice").value,
    ex("Bob").value,
  ]);
});

test("instancesMatchingFilterShape: a class-taxonomy pick (st:classIn, SubClassFacet) also matches an instance tagged with a subclass", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}

     ex:property1 sh:path ex:category ; sh:rootClass ex:Category .
     ex:Electronics rdfs:subClassOf ex:Category .
     ex:Computers rdfs:subClassOf ex:Electronics .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}

     ex:widget ex:category ex:Electronics .
     ex:laptop ex:category ex:Computers .
     ex:novel ex:category ex:Books .`,
    "text/turtle",
  );
  const property = new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(filterShape, property, st("classIn"), [ex("Electronics")]);

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("widget"), ex("laptop"), ex("novel")]);

  expect(matchingValues).toEqual(
    [ex("widget").value, ex("laptop").value].sort(),
  );
});

test("instancesMatchingFilterShape: plain sh:in (CategoryFacet) still requires an exact match despite a subClassOf relation existing", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}

     ex:property1 sh:path ex:category .
     ex:Computers rdfs:subClassOf ex:Electronics .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}

     ex:widget ex:category ex:Electronics .
     ex:laptop ex:category ex:Computers .`,
    "text/turtle",
  );
  const property = new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(filterShape, property, sh("in"), [ex("Electronics")]);

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("widget"), ex("laptop")]);

  expect(matchingValues).toEqual([ex("widget").value]);
});

test("instancesMatchingFilterShape: st:withinArea (MapFacet) matches an instance whose value falls inside the drawn polygon", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:property1 sh:path ex:location .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}

     ex:paris ex:location "POINT (2.35 48.85)"^^geosparql:wktLiteral .
     ex:tokyo ex:location "POINT (139.69 35.68)"^^geosparql:wktLiteral .`,
    "text/turtle",
  );
  const property = new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(
    filterShape,
    property,
    st("withinArea"),
    factory.literal("POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))", geosparql("wktLiteral")),
  );

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("paris"), ex("tokyo")]);

  expect(matchingValues).toEqual([ex("paris").value]);
});

test("instancesMatchingFilterShape: st:withinArea matches any instance value against any drawn polygon (a MultiPolygon selection is an OR)", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:property1 sh:path ex:location .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}

     ex:paris ex:location "POINT (2.35 48.85)"^^geosparql:wktLiteral .
     ex:tokyo ex:location "POINT (139.69 35.68)"^^geosparql:wktLiteral .
     ex:capeTown ex:location "POINT (18.42 -33.92)"^^geosparql:wktLiteral .`,
    "text/turtle",
  );
  const property = new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
  const filterShape = createFilterShape();
  // Two separate drawn rectangles - one over Europe, one over Japan - combined into a single
  // MultiPolygon selection literal, the same way MapFacet's own drawnFeaturesToAreaLiteral does.
  setFilterConstraintForProperty(
    filterShape,
    property,
    st("withinArea"),
    factory.literal(
      "MULTIPOLYGON (((-10 35, 20 35, 20 60, -10 60, -10 35)), ((120 20, 150 20, 150 45, 120 45, 120 20)))",
      geosparql("wktLiteral"),
    ),
  );

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("paris"), ex("tokyo"), ex("capeTown")]);

  expect(matchingValues).toEqual(
    [ex("paris").value, ex("tokyo").value].sort(),
  );
});

test("setFilterConstraintForProperty: st:withinArea also writes a sibling sh:sparql SPARQLConstraint built on geof:sfWithin", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:location .`);
  const filterShape = createFilterShape();

  setFilterConstraintForProperty(
    filterShape,
    property,
    st("withinArea"),
    factory.literal("POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))", geosparql("wktLiteral")),
  );

  const constraintNode = findFilterConstraintNode(filterShape, property)!;
  const sparqlNode = filterShape.store.getQuads(constraintNode, sh("sparql"))[0]?.object;
  expect(sparqlNode).toBeDefined();
  expect(filterShape.store.getQuads(sparqlNode, rdf("type"), sh("SPARQLConstraint")).length).toBe(1);

  const selectQuery = filterShape.store.getQuads(sparqlNode, sh("select"))[0]?.object.value;
  expect(selectQuery).toContain("geof:sfWithin");
  expect(selectQuery).toContain("POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))");
  expect(selectQuery).toContain("<http://example.org/location>");
});

test("setFilterConstraintForProperty: clearing st:withinArea removes the sh:sparql entry too (and prunes the whole constraint node)", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:location .`);
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(
    filterShape,
    property,
    st("withinArea"),
    factory.literal("POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))", geosparql("wktLiteral")),
  );

  setFilterConstraintForProperty(filterShape, property, st("withinArea"), undefined);

  expect(findFilterConstraintNode(filterShape, property)).toBeUndefined();
  // Just the root's own rdf:type sh:NodeShape triple from createFilterShape - nothing of the
  // constraint node (sh:path, sh:sparql and its own blank-node closure) survives.
  expect(filterShape.store.getQuads().length).toBe(1);
});

test("setFilterConstraintForProperty: the generated sh:select uses a for-all shape (FILTER NOT EXISTS a satisfying value) meaning 'some value inside, or it's a violation'", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:location .`);
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(
    filterShape,
    property,
    st("withinArea"),
    factory.literal("POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))", geosparql("wktLiteral")),
  );

  const constraintNode = findFilterConstraintNode(filterShape, property)!;
  const sparqlNode = filterShape.store.getQuads(constraintNode, sh("sparql"))[0].object;
  const selectQuery = filterShape.store.getQuads(sparqlNode, sh("select"))[0].object.value;

  // Not run end-to-end through this app's own Comunica engine: FILTER NOT EXISTS with a custom
  // extension function nested inside it doesn't correlate $this correctly in Comunica 4.5 (verified
  // separately against a minimal repro - MINUS-shaped negation correlates fine, FILTER NOT EXISTS
  // doesn't). That's a real limitation of this app's own bundled engine, not of the generated query
  // text - this constraint is meant for an external SHACL-SPARQL-conformant consumer, which
  // FILTER NOT EXISTS is the spec-correct, portable shape for (and matches this renderer's own
  // "zero values for the path is also a violation" edge case - a MINUS-based rewrite, which requires
  // $this to already have at least one matching value to appear as a row at all, would silently drop
  // that case).
  expect(selectQuery).toMatch(/select \$this where/);
  expect(selectQuery).toMatch(/filter not exists \{/);
  expect(selectQuery).toContain("$this <http://example.org/location> ?withinAreaValue");
  expect(selectQuery).toContain(
    'geof:sfWithin(?withinAreaValue, "POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))"^^<http://www.opengis.net/ont/geosparql#wktLiteral>)',
  );
});

test("instancesMatchingFilterShape: st:colorBucket (ColorFacet) matches an instance whose color value classifies into the chosen bucket", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:property1 sh:path ex:color .`,
    "text/turtle",
  );
  const redColor = factory.blankNode();
  const blueColor = factory.blankNode();
  const dataGraph = await parseRdf("", "text/turtle");
  dataGraph.addQuad(factory.quad(ex("fireTruck"), ex("color"), redColor));
  dataGraph.addQuad(factory.quad(redColor, st("hue"), factory.literal("0", xsd("decimal"))));
  dataGraph.addQuad(factory.quad(redColor, st("saturation"), factory.literal("100", xsd("decimal"))));
  dataGraph.addQuad(factory.quad(redColor, st("lightness"), factory.literal("50", xsd("decimal"))));
  dataGraph.addQuad(factory.quad(ex("sky"), ex("color"), blueColor));
  dataGraph.addQuad(factory.quad(blueColor, st("hue"), factory.literal("240", xsd("decimal"))));
  dataGraph.addQuad(
    factory.quad(blueColor, st("saturation"), factory.literal("100", xsd("decimal"))),
  );
  dataGraph.addQuad(factory.quad(blueColor, st("lightness"), factory.literal("50", xsd("decimal"))));

  const property = new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(filterShape, property, st("colorBucket"), factory.literal("red"));

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("fireTruck"), ex("sky")]);

  expect(matchingValues).toEqual([ex("fireTruck").value]);
});

test("setFilterConstraintForProperty: st:colorBucket also writes a sibling sh:sparql SPARQLConstraint built on sparqlFilterForBucket", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:color .`);
  const filterShape = createFilterShape();

  setFilterConstraintForProperty(filterShape, property, st("colorBucket"), factory.literal("blue"));

  const constraintNode = findFilterConstraintNode(filterShape, property)!;
  const sparqlNode = filterShape.store.getQuads(constraintNode, sh("sparql"))[0]?.object;
  expect(sparqlNode).toBeDefined();
  expect(filterShape.store.getQuads(sparqlNode, rdf("type"), sh("SPARQLConstraint")).length).toBe(1);

  const selectQuery = filterShape.store.getQuads(sparqlNode, sh("select"))[0]?.object.value;
  expect(selectQuery).toContain("st:hue");
  expect(selectQuery).toContain("?hue >= 200 && ?hue < 260");
  expect(selectQuery).toContain("<http://example.org/color>");
});

test("setFilterConstraintForProperty: clearing st:colorBucket removes the sh:sparql entry too (and prunes the whole constraint node)", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:color .`);
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(filterShape, property, st("colorBucket"), factory.literal("blue"));

  setFilterConstraintForProperty(filterShape, property, st("colorBucket"), undefined);

  expect(findFilterConstraintNode(filterShape, property)).toBeUndefined();
  // Just the root's own rdf:type sh:NodeShape triple from createFilterShape - nothing of the
  // constraint node (sh:path, sh:sparql and its own blank-node closure) survives.
  expect(filterShape.store.getQuads().length).toBe(1);
});

test("setFilterConstraintForProperty: the generated sh:select for st:colorBucket uses a for-all shape (FILTER NOT EXISTS a satisfying value)", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:color .`);
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(filterShape, property, st("colorBucket"), factory.literal("red"));

  const constraintNode = findFilterConstraintNode(filterShape, property)!;
  const sparqlNode = filterShape.store.getQuads(constraintNode, sh("sparql"))[0].object;
  const selectQuery = filterShape.store.getQuads(sparqlNode, sh("select"))[0].object.value;

  expect(selectQuery).toMatch(/select \$this where/);
  expect(selectQuery).toMatch(/filter not exists \{/);
  expect(selectQuery).toContain("$this <http://example.org/color> ?colorValue");
  expect(selectQuery).toContain("?colorValue st:hue ?hue ; st:saturation ?sat ; st:lightness ?light");
  expect(selectQuery).toContain("(?hue < 15 || ?hue >= 345)");
});

test("instancesMatchingFilterShape: sh:minInclusive/sh:maxInclusive keep only instances whose value falls in range", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:price .`);
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:widget ex:price 15 . ex:gadget ex:price 25 . ex:novel ex:price 5 .`,
    "text/turtle",
  );
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(
    filterShape,
    property,
    sh("minInclusive"),
    factory.literal("10", xsd("integer")),
  );
  setFilterConstraintForProperty(
    filterShape,
    property,
    sh("maxInclusive"),
    factory.literal("20", xsd("integer")),
  );

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("widget"), ex("gadget"), ex("novel")]);

  expect(matchingValues).toEqual([ex("widget").value]);
});

test("instancesMatchingFilterShape: sh:minExclusive/sh:maxExclusive exclude their own boundary value", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:price .`);
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:widget ex:price 10 . ex:gadget ex:price 15 . ex:novel ex:price 20 .`,
    "text/turtle",
  );
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(
    filterShape,
    property,
    sh("minExclusive"),
    factory.literal("10", xsd("integer")),
  );
  setFilterConstraintForProperty(
    filterShape,
    property,
    sh("maxExclusive"),
    factory.literal("20", xsd("integer")),
  );

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("widget"), ex("gadget"), ex("novel")]);

  // widget (10) and novel (20) sit exactly on the exclusive boundaries, so only gadget (15) matches.
  expect(matchingValues).toEqual([ex("gadget").value]);
});

test("setFilterConstraintsForProperty: writing two predicates as one call on a brand-new node is visible to a reactive subscriber in a single notification, not split across two", async () => {
  // Reproduces ColorFacet's own bucket-click handler: two predicates written for one user gesture,
  // on a property no facet has touched yet. This must go through setFilterConstraintsForProperty
  // (one call, both entries) rather than two separate setFilterConstraintForProperty calls: a
  // sibling's reactive read (useReactiveRead, simulated here via reactivity.track/subscribe the
  // same way it's actually used) re-tracks its own read pattern against the node itself the first
  // time it's notified - so a *second*, separate call writing to that same brand-new node moments
  // later would write correctly into the store but never re-notify a subscriber that's still
  // watching the (now-stale) pattern it tracked before the node existed. Writing both predicates in
  // one call avoids ever exposing that intermediate half-written state to begin with.
  const property = await propertyFor(`ex:property1 sh:path ex:color .`);
  const filterShape = createFilterShape();
  const reactivity = getReactivity(filterShape.store)!;

  const track = () => {
    const node = findFilterConstraintNode(filterShape, property);
    return node
      ? {
          minInclusive: valueQuads(filterShape, node, "minInclusive")[0]?.object.value,
          maxExclusive: valueQuads(filterShape, node, "maxExclusive")[0]?.object.value,
        }
      : undefined;
  };

  let lastSeen: ReturnType<typeof track> | undefined;
  const { patterns } = reactivity.track(() => {
    lastSeen = track();
  });
  reactivity.subscribe(patterns, () => {
    lastSeen = track();
  });

  setFilterConstraintsForProperty(filterShape, property, [
    [sh("minInclusive"), factory.literal("-15", xsd("decimal"))],
    [sh("maxExclusive"), factory.literal("15", xsd("decimal"))],
  ]);

  expect(lastSeen).toEqual({ minInclusive: "-15", maxExclusive: "15" });
});

test("removeFilterConstraintsForPaths: an empty path set is a no-op", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:age .`);
  const filterShape = createFilterShape();
  getFilterConstraintNode(filterShape, property);

  removeFilterConstraintsForPaths(filterShape, new Set());

  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property")).length).toBe(1);
});

test("instancesMatchingFilterShape: sh:pattern (TextSearchFacet) matches when any one value on an sh:alternativePath matches, not every value", async () => {
  // Mirrors preprocess/shapes.ts's mergeFacetTextSearchProperties: one search box across several
  // text predicates. Plain SHACL sh:pattern would demand the nationality match "Gordon" too.
  const shapesGraph = await parseRdf(
    `${queryPrefixes}

     ex:property1 sh:path [ sh:alternativePath ( ex:name ex:nationality ) ] .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}

     ex:gordon ex:name "Gordon Ramsay"@en ; ex:nationality "British"@en .
     ex:massimo ex:name "Massimo Bottura"@en ; ex:nationality "Italian"@en .`,
    "text/turtle",
  );
  const property = new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
  const filterShape = createFilterShape();
  setFilterConstraintsForProperty(filterShape, property, [
    [sh("pattern"), factory.literal("gordon", xsd("string"))],
    [sh("flags"), factory.literal("i", xsd("string"))],
  ]);

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("gordon"), ex("massimo")]);

  expect(matchingValues).toEqual([ex("gordon").value]);
});

test("instancesMatchingFilterShape: a range bound matches when any one value falls inside it, not every value", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}

     ex:property1 sh:path ex:price .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}

     ex:mixed ex:price 5, 50 .
     ex:cheap ex:price 5 .`,
    "text/turtle",
  );
  const property = new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(
    filterShape,
    property,
    sh("minInclusive"),
    factory.literal("10", xsd("integer")),
  );

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [ex("mixed"), ex("cheap")]);

  expect(matchingValues).toEqual([ex("mixed").value]);
});

test("setFilterConstraint: value-level constraints are written inside sh:qualifiedValueShape with sh:qualifiedMinCount 1", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:category .`);
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(filterShape, property, sh("in"), [ex("A")]);

  const node = findFilterConstraintNode(filterShape, property)!;
  // "At least one value is in (A)" - never plain sh:in on the property node, which in SHACL means
  // "every value is in (A)" and lets an instance with no value at all conform.
  expect(filterShape.store.getQuads(node, sh("in"))).toEqual([]);
  expect(filterShape.store.getQuads(node, sh("qualifiedMinCount"))[0]?.object.value).toBe("1");
  expect(readFilterConstraint(filterShape, node, sh("in")).map((term) => term.value)).toEqual([
    ex("A").value,
  ]);

  setFilterConstraintForProperty(filterShape, property, sh("in"), undefined);
  expect(filterShape.store.getQuads().length).toBe(1);
});

test("instancesMatchingFilterShape: sh:in matches an instance with several values when any one is picked, and never one with no value", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:category .`);
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:both ex:category ex:A, ex:B . ex:onlyA ex:category ex:A . ex:none ex:other ex:x .`,
    "text/turtle",
  );
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(filterShape, property, sh("in"), [ex("A")]);

  const matchingValues = await matching(filterShape, dataGraph, property.shapesGraph, [
    ex("both"),
    ex("onlyA"),
    ex("none"),
  ]);

  expect(matchingValues).toEqual([ex("both").value, ex("onlyA").value].sort());
});

test("instancesMatchingFilterShape: an explicit empty sh:in (a search with no results) matches nothing", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:name .`);
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n ex:a ex:name "A" . ex:b ex:other "B" .`, "text/turtle");
  const filterShape = createFilterShape();
  setFilterConstraintForProperty(filterShape, property, sh("in"), rdf("nil"));

  expect(await matching(filterShape, dataGraph, property.shapesGraph, [ex("a"), ex("b")])).toEqual([]);
});
