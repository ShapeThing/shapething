import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { getRdfList } from "@/helpers/rdfList.ts";
import { ex, queryPrefixes, rdf, sh, xsd } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import {
  createFilterShape,
  findFilterConstraintNode,
  getFilterConstraintNode,
  pathSparqlFor,
  removeFilterConstraintsForPaths,
  setFilterConstraint,
  setFilterConstraintForProperty,
} from "@/structure/filterShape.ts";

async function propertyFor(pathTurtle: string) {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${pathTurtle}`, "text/turtle");
  const dataGraph = await parseRdf("", "text/turtle");
  return new PropertyUIElement({
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
  expect(filterShape.store.getQuads(node, sh("minInclusive"))[0]?.object.value).toEqual("10");

  setFilterConstraint(filterShape, node, sh("minInclusive"), factory.literal("20", xsd("integer")));
  expect(
    filterShape.store.getQuads(node, sh("minInclusive")).map((quad) => quad.object.value),
  ).toEqual(["20"]);

  setFilterConstraint(filterShape, node, sh("minInclusive"), undefined);
  expect(filterShape.store.getQuads(node, sh("minInclusive"))).toEqual([]);
});

test("setFilterConstraint: writes a multi-valued constraint as a fresh SHACL list", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:type .`);
  const filterShape = createFilterShape();
  const node = getFilterConstraintNode(filterShape, property);

  setFilterConstraint(filterShape, node, sh("in"), [ex("Cat"), ex("Dog")]);

  const listHead = filterShape.store.getQuads(node, sh("in"))[0]?.object;
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
  expect(filterShape.store.getQuads(node, sh("maxInclusive"))[0]?.object.value).toEqual("20");
});

test("setFilterConstraint: clearing a list-valued constraint deletes the old list's own cells", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:type .`);
  const filterShape = createFilterShape();
  const node = getFilterConstraintNode(filterShape, property);

  setFilterConstraint(filterShape, node, sh("in"), [ex("Cat"), ex("Dog")]);
  const listHead = filterShape.store.getQuads(node, sh("in"))[0]?.object;

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

  const listHead = filterShape.store.getQuads(node, sh("in"))[0]?.object;
  expect(getRdfList(listHead!, filterShape.store).map((term) => term.value)).toEqual([
    ex("Cat").value,
  ]);
  // Exactly one sh:in triple should remain pointing at the (rebuilt) list.
  expect(filterShape.store.getQuads(node, sh("in")).length).toBe(1);
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
    const listHead = node ? filterShape.store.getQuads(node, sh("in"))[0]?.object : undefined;
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
  const listHead = filterShape.store.getQuads(node, sh("in"))[0]?.object;
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
  const listHead = filterShape.store.getQuads(nameNode, sh("in"))[0]?.object;
  expect(getRdfList(listHead!, filterShape.store).map((term) => term.value)).toEqual([
    ex("Alice").value,
    ex("Bob").value,
  ]);
});

test("removeFilterConstraintsForPaths: an empty path set is a no-op", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:age .`);
  const filterShape = createFilterShape();
  getFilterConstraintNode(filterShape, property);

  removeFilterConstraintsForPaths(filterShape, new Set());

  expect(filterShape.store.getQuads(filterShape.rootNode, sh("property")).length).toBe(1);
});
