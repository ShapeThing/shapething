import { expect, test } from "vite-plus/test";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { groupChildren } from "@/structure/groupChildren.ts";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { GroupUIElement } from "@/structure/GroupUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, sh } from "@/helpers/namespaces.ts";

function path(property: PropertyUIElement): string | undefined {
  return property.get(sh("path"))[0]?.value;
}

test("properties sharing a sh:group nest under one GroupUIElement, sorted by sh:order", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:familyName ; sh:order 1 ; sh:group ex:nameGroup ] ;
            sh:property [ sh:path ex:givenName ; sh:order 0 ; sh:group ex:nameGroup ] .

        ex:nameGroup a sh:PropertyGroup .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");

  const elements = childrenForShape(shapesGraph, dataGraph, ex("Person"), ex("Hendrik"));
  const grouped = groupChildren(elements, shapesGraph, dataGraph, ex("Hendrik"));

  expect(grouped).toHaveLength(1);
  const [group] = grouped as GroupUIElement[];
  expect(group).toBeInstanceOf(GroupUIElement);
  expect(group.node.value).toEqual(ex("nameGroup").value);
  expect(group.children).toHaveLength(2);
  expect((group.children as PropertyUIElement[]).map(path)).toEqual([
    ex("givenName").value,
    ex("familyName").value,
  ]);
});

test("a group whose own sh:group points at another group nests underneath it", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:givenName ; sh:group ex:nameGroup ] ;
            sh:property [ sh:path ex:city ; sh:group ex:addressGroup ] .

        ex:rootGroup a sh:PropertyGroup .
        ex:nameGroup a sh:PropertyGroup ; sh:group ex:rootGroup ; sh:order 0 .
        ex:addressGroup a sh:PropertyGroup ; sh:group ex:rootGroup ; sh:order 1 .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");

  const elements = childrenForShape(shapesGraph, dataGraph, ex("Person"), ex("Hendrik"));
  const grouped = groupChildren(elements, shapesGraph, dataGraph, ex("Hendrik"));

  expect(grouped).toHaveLength(1);
  const [root] = grouped as GroupUIElement[];
  expect(root.node.value).toEqual(ex("rootGroup").value);
  expect(root.children).toHaveLength(2);

  const [nameGroup, addressGroup] = root.children as GroupUIElement[];
  expect(nameGroup.node.value).toEqual(ex("nameGroup").value);
  expect(nameGroup.children).toHaveLength(1);
  expect(addressGroup.node.value).toEqual(ex("addressGroup").value);
  expect(addressGroup.children).toHaveLength(1);
});

test("ungrouped properties and top-level groups interleave by sh:order", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:notes ; sh:order 1 ] ;
            sh:property [ sh:path ex:givenName ; sh:group ex:nameGroup ] .

        ex:nameGroup a sh:PropertyGroup ; sh:order 2 .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");

  const elements = childrenForShape(shapesGraph, dataGraph, ex("Person"), ex("Hendrik"));
  const grouped = groupChildren(elements, shapesGraph, dataGraph, ex("Hendrik"));

  expect(grouped).toHaveLength(2);
  expect(grouped[0]).toBeInstanceOf(PropertyUIElement);
  expect(path(grouped[0] as PropertyUIElement)).toEqual(ex("notes").value);
  expect(grouped[1]).toBeInstanceOf(GroupUIElement);
  expect((grouped[1] as GroupUIElement).node.value).toEqual(ex("nameGroup").value);
});

test("a shapes graph with no sh:group/sh:order at all sorts identically to the flat input", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:givenName ] ;
            sh:property [ sh:path ex:familyName ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");

  const elements = childrenForShape(shapesGraph, dataGraph, ex("Person"), ex("Hendrik"));
  const grouped = groupChildren(elements, shapesGraph, dataGraph, ex("Hendrik"));

  expect(grouped).toHaveLength(2);
  expect((grouped as PropertyUIElement[]).map((p) => p.propertyShapes[0].value)).toEqual(
    (elements as PropertyUIElement[]).map((p) => p.propertyShapes[0].value),
  );
});

test("throws when a property's sh:group references a node not typed sh:PropertyGroup", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:givenName ; sh:group ex:nameGroup ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");

  const elements = childrenForShape(shapesGraph, dataGraph, ex("Person"), ex("Hendrik"));
  expect(() => groupChildren(elements, shapesGraph, dataGraph, ex("Hendrik"))).toThrow(
    /Missing sh:PropertyGroup definition/,
  );
});

test("a ChoiceElement (sh:or) is never grouped, but still participates in top-level ordering", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:givenName ; sh:group ex:nameGroup ] ;
            sh:or (
                [ sh:property [ sh:path ex:email ] ]
                [ sh:property [ sh:path ex:phone ] ]
            ) .

        ex:nameGroup a sh:PropertyGroup .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");

  const elements = childrenForShape(shapesGraph, dataGraph, ex("Person"), ex("Hendrik"));
  const grouped = groupChildren(elements, shapesGraph, dataGraph, ex("Hendrik"));

  expect(grouped).toHaveLength(2);
  expect(grouped.some((element) => element instanceof ChoiceElement)).toBe(true);
  expect(grouped.some((element) => element instanceof GroupUIElement)).toBe(true);
});
