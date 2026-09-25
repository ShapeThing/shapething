import { expect, test } from "vite-plus/test";
import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { ex, queryPrefixes, rdf, sh } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { groupChildren } from "@/structure/groupChildren.ts";
import { logicalBranches, withBranch } from "@/structure/logicalBranches.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import { NO_WIDGETS } from "@/widgets/lookup.ts";

const shapesTurtle = `${queryPrefixes}
ex:Person a sh:NodeShape ;
  sh:property [ sh:path ex:name ; sh:group ex:nameGroup ] ;
  sh:property [ sh:path ex:age ; sh:or ( [ sh:datatype xsd:integer ] [ sh:datatype xsd:string ] ) ] ;
  sh:xone ( [ sh:property [ sh:path ex:email ] ] [ sh:property [ sh:path ex:phone ] ] ) .
ex:nameGroup a sh:PropertyGroup .
`;

async function setup() {
  const shapesGraph = await parseRdf(shapesTurtle, "text/turtle");
  const dataGraph = makeReactive(
    await parseRdf(`${queryPrefixes}\nex:alice ex:name "Alice" .`, "text/turtle"),
  );
  const node = (focusNode: Quad_Subject = ex("alice"), ancestorPath?: string[]) =>
    new NodeUIElement({
      shapesGraph,
      dataGraph,
      widgetRegistry: defaultWidgets,
      focusNode,
      nodeShapes: [ex("Person")],
      ancestorPath,
    });
  return { shapesGraph, dataGraph, node };
}

const byPath = (elements: ReturnType<NodeUIElement["children"]>, predicate: NamedNode) =>
  elements.find(
    (element): element is PropertyUIElement =>
      element.kind === "property" && element.get(sh("path"))[0]?.equals(predicate) === true,
  )!;

test("children() hands back the same array and element instances for the same inputs", async () => {
  const { node } = await setup();
  const first = node();
  const second = node();

  expect(first.children()).toBe(first.children());
  // Two separately-constructed NodeUIElements (as a render does with useMemo) still share them.
  expect(second.children()).toBe(first.children());
});

test("children() builds distinct elements for a different focus node or ancestorPath", async () => {
  const { node } = await setup();
  const base = node().children();

  expect(node(ex("bob")).children()).not.toBe(base);
  expect(node(ex("alice"), ["<http://example.org/parent>"]).children()).not.toBe(base);
  expect(node(ex("alice"), ["<http://example.org/parent>"]).children()).toBe(
    node(ex("alice"), ["<http://example.org/parent>"]).children(),
  );
});

test("a different widget registry yields its own elements, each carrying that registry", async () => {
  const { shapesGraph, dataGraph } = await setup();
  const withDefault = childrenForShape(shapesGraph, dataGraph, ex("Person"), ex("alice"), undefined, defaultWidgets);
  const withNone = childrenForShape(shapesGraph, dataGraph, ex("Person"), ex("alice"), undefined, NO_WIDGETS);

  expect(withNone).not.toBe(withDefault);
  expect(withNone.every((element) => element.widgetRegistry === NO_WIDGETS)).toBe(true);
});

test("memoized elements still read dataGraph live", async () => {
  const { dataGraph, node } = await setup();
  const name = byPath(node().children(), ex("name"));
  expect(name.getObjects().map((term) => term.value)).toEqual(["Alice"]);

  dataGraph.addQuad(factory.quad(ex("alice"), ex("name"), factory.literal("Ali")));

  const nameAfterWrite = byPath(node().children(), ex("name"));
  expect(nameAfterWrite).toBe(name);
  expect(nameAfterWrite.getObjects().map((term) => term.value).sort()).toEqual(["Ali", "Alice"]);
});

test("groupChildren() returns the same group tree for the same children array", async () => {
  const { shapesGraph, dataGraph, node } = await setup();
  const children = node().children();
  const grouped = groupChildren(children, shapesGraph, dataGraph, ex("alice"), defaultWidgets);

  expect(groupChildren(node().children(), shapesGraph, dataGraph, ex("alice"), defaultWidgets)).toBe(grouped);
  expect(grouped.some((child) => child.kind === "group")).toBe(true);
});

test("ChoiceElement.children() returns the same branch arrays on every call", async () => {
  const { node } = await setup();
  const choice = node().children().find((element): element is ChoiceElement => element.kind === "choice")!;

  expect(choice.children()).toBe(choice.children());
  expect(choice.children()[0][0]).toBe(choice.children()[0][0]);
});

test("withBranch() returns the same view per (element, branch), and a different one per branch", async () => {
  const { node } = await setup();
  const age = byPath(node().children(), ex("age"));
  const [integerBranch, stringBranch] = logicalBranches(age);

  const view = withBranch(age, integerBranch.shape);
  expect(withBranch(age, integerBranch.shape)).toBe(view);
  expect(withBranch(age, stringBranch.shape)).not.toBe(view);
  expect(view.get(sh("datatype"))?.value).toBe("http://www.w3.org/2001/XMLSchema#integer");
});

test("propertyPath() is parsed once and reused", async () => {
  const { node } = await setup();
  const name = byPath(node().children(), ex("name"));
  expect(name.propertyPath()).toBe(name.propertyPath());
  expect(name.pathAsSparql()).toBe("<http://example.org/name>");
});

test("widgetShapeSource() builds the merged shape once, including nested blank-node structure", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}
    ex:a sh:path ex:value ; sh:datatype ( xsd:string rdf:langString ) .
    ex:b sh:path ex:value ; sh:minCount 1 .`,
    "text/turtle",
  );
  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph: await parseRdf("", "text/turtle"),
    widgetRegistry: defaultWidgets,
    focusNode: ex("alice"),
    propertyShapes: [ex("a"), ex("b")],
  });

  const source = element.widgetShapeSource();
  expect(element.widgetShapeSource()).toBe(source);

  const { shapeNode, shapesGraph: merged } = source;
  expect(merged.getQuads(shapeNode, sh("minCount"))).toHaveLength(1);
  const [datatypeQuad] = merged.getQuads(shapeNode, sh("datatype"));
  // The list's own cells came along with the merged node, not just its head.
  const firstCell = merged.getQuads(datatypeQuad.object as Quad_Subject, rdf("first"));
  expect(firstCell.map((quad) => quad.object.value)).toEqual(["http://www.w3.org/2001/XMLSchema#string"]);
  const [rest] = merged.getQuads(datatypeQuad.object as Quad_Subject, rdf("rest"));
  expect(merged.getQuads(rest.object as Quad_Subject, rdf("first"))[0]?.object.value).toBe(
    rdf("langString").value,
  );
});

test("widgetShapeSource() uses the property shape itself when there's only one", async () => {
  const { node, shapesGraph } = await setup();
  const name = byPath(node().children(), ex("name"));
  const { shapeNode, shapesGraph: source } = name.widgetShapeSource();
  expect(shapeNode).toBe(name.propertyShapes[0]);
  expect(source).toBe(shapesGraph);
});
