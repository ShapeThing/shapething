import { expect, test } from "vite-plus/test";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { propertiesForShape } from "@/structure/propertiesForShape.ts";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

test("sh:node directly on a shape expands to that node shape's own properties", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:node ex:Metadata .

        ex:Metadata a sh:NodeShape ;
            sh:property [ sh:path ex:title ] .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const elements = childrenForShape(shapesGraph, dataGraph, ex("Recipe"), ex("ChickenSoup"));
  expect(elements).toHaveLength(1);
  expect(elements[0]).toBeInstanceOf(PropertyUIElement);
});

test("sh:node inside a sh:or branch expands against the same focus node (mirrors 7.7.3.f)", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:or (
                [ sh:property [ sh:path ex:address ] ]
                [
                    sh:node [
                        sh:property [ sh:path ex:street ] ;
                        sh:property [ sh:path ex:city ] ;
                    ]
                ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .

        ex:Hendrik ex:street "Dam" ; ex:city "Amsterdam" .
    `,
    "text/turtle",
  );

  const [choice] = childrenForShape(
    shapesGraph,
    dataGraph,
    ex("Person"),
    ex("Hendrik"),
  ) as ChoiceElement[];
  expect(choice).toBeInstanceOf(ChoiceElement);

  const branches = choice.children();
  expect(branches).toHaveLength(2);
  expect(branches[0]).toHaveLength(1);

  // The "structured fields" branch has no sh:property of its own - only via sh:node - so this
  // is the direct regression check for the previously-empty-branch gap.
  const structuredBranch = branches[1] as PropertyUIElement[];
  expect(structuredBranch).toHaveLength(2);
  expect(structuredBranch.map((property) => property.getObjects()[0]?.value)).toEqual([
    "Dam",
    "Amsterdam",
  ]);
});

test("a sh:and branch containing a further sh:or recurses into a nested ChoiceElement", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:and (
                [
                    sh:property [ sh:path ex:title ] ;
                    sh:or (
                        [ sh:property [ sh:path ex:meatType ] ]
                        [ sh:property [ sh:path ex:veganCertification ] ]
                    ) ;
                ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const elements = childrenForShape(shapesGraph, dataGraph, ex("Recipe"), ex("ChickenSoup"));
  expect(elements).toHaveLength(2);
  expect(elements[0]).toBeInstanceOf(PropertyUIElement);
  expect(elements[1]).toBeInstanceOf(ChoiceElement);
});

test("a branch shape that itself declares sh:or produces a nested ChoiceElement", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:or (
                [
                    sh:property [ sh:path ex:servings ] ;
                    sh:or (
                        [ sh:property [ sh:path ex:veganCertification ] ]
                        [ sh:property [ sh:path ex:halalCertification ] ]
                    ) ;
                ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const [choice] = childrenForShape(
    shapesGraph,
    dataGraph,
    ex("Recipe"),
    ex("ChickenSoup"),
  ) as ChoiceElement[];
  const [branch] = choice.children();
  expect(branch).toHaveLength(2);
  expect(branch[0]).toBeInstanceOf(PropertyUIElement);
  expect(branch[1]).toBeInstanceOf(ChoiceElement);
});

test("a plain sh:property-only shape matches propertiesForShape directly", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ] .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const expected = propertiesForShape(shapesGraph, dataGraph, ex("Recipe"), ex("ChickenSoup"));
  const actual = childrenForShape(shapesGraph, dataGraph, ex("Recipe"), ex("ChickenSoup"));

  // Not a deep toEqual: both sides construct their own PropertyUIElement, each defaulting its own
  // scoresGraph (RdfStore.createDefault()) - an internal blank-node counter that differs between
  // the two independently-created instances despite being otherwise identical.
  expect(actual).toHaveLength(expected.length);
  expect(actual.every((element) => element instanceof PropertyUIElement)).toBe(true);
  expect((actual as PropertyUIElement[]).map((element) => element.propertyShapes[0].value)).toEqual(
    expected.map((element) => element.propertyShapes[0].value),
  );
});
