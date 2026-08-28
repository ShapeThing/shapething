import { expect, test } from "vite-plus/test";
import type { BlankNode } from "@rdfjs/types";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

test("NodeUIElement", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        ex:Recipe a sh:NodeShape, rdfs:Class ;
            sh:property [
                sh:path ex:ingredient ;
                sh:minCount 2 ;
            ] .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .

        ex:ChickenSoup a ex:Recipe ;
            ex:ingredient ex:Chicken, ex:Water, ex:Salt .
    `,
    "text/turtle",
  );

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    nodeShapes: [ex("Recipe")],
  });
  expect(node).toBeInstanceOf(NodeUIElement);
  expect(node.children()).toHaveLength(1);
});

test("propertyUiElements groups two property shapes with an identical sh:path into a single element", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:property ex:ingredientMinShape, ex:ingredientMaxShape .

        ex:ingredientMinShape a sh:PropertyShape ;
            sh:path ex:ingredient ;
            sh:minCount 1 .

        ex:ingredientMaxShape a sh:PropertyShape ;
            sh:path ex:ingredient ;
            sh:maxCount 10 .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    nodeShapes: [ex("Recipe")],
  });

  expect(node.children()).toHaveLength(1);
});

test("propertyUiElements groups sh:path forms that resolve to the same path", async () => {
  // ex:ingredient and ( ex:ingredient ) are different sh:path RDF terms
  // (a NamedNode vs. a one-element rdf:List), but both describe the same
  // SPARQL property path, so they should still be treated as one path.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:property ex:ingredientShape, ex:ingredientSequenceShape .

        ex:ingredientShape a sh:PropertyShape ;
            sh:path ex:ingredient ;
            sh:minCount 1 .

        ex:ingredientSequenceShape a sh:PropertyShape ;
            sh:path ( ex:ingredient ) ;
            sh:maxCount 10 .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    nodeShapes: [ex("Recipe")],
  });

  expect(node.children()).toHaveLength(1);
});

test("propertyUiElements keeps distinct paths as separate elements", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:ingredient ], [ sh:path ex:instructions ] .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    nodeShapes: [ex("Recipe")],
  });

  expect(node.children()).toHaveLength(2);
});

test("propertyUiElements merges an equal path declared on separate node shapes into one element", async () => {
  // MeatRecipe and VeganRecipe both apply to the same focus node and each independently declares
  // its own property shape on ex:ingredient - two distinct sh:PropertyShape nodes, but the same
  // SPARQL path. SHACL treats co-path property shapes as conjunctive constraints on one logical
  // property regardless of which applicable shape declares them, so these must render as a single
  // field (both minCounts folded together), not two separate widgets editing the same triples.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:MeatRecipe a sh:NodeShape ;
            sh:property [ sh:path ex:ingredient ; sh:minCount 1 ] .

        ex:VeganRecipe a sh:NodeShape ;
            sh:property [ sh:path ex:ingredient ; sh:minCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    nodeShapes: [ex("MeatRecipe"), ex("VeganRecipe")],
  });

  const elements = node.children();
  expect(elements).toHaveLength(1);
  expect((elements[0] as PropertyUIElement).propertyShapes).toHaveLength(2);
});

test("does not duplicate properties when a nodeShape is listed both directly and via another listed shape's sh:node", async () => {
  // Mirrors the academic showcase: ResearcherShape pulls in PersonShape via sh:node (its own
  // "inherits" mechanism), but callers may also list PersonShape directly in nodeShapes (e.g.
  // because the focus node's rdf:type independently matches it) - that shouldn't double the
  // shared properties.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:PersonShape a sh:NodeShape ;
            sh:property [ sh:path ex:name ] .

        ex:ResearcherShape a sh:NodeShape ;
            sh:node ex:PersonShape ;
            sh:property [ sh:path ex:jobTitle ] .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
    nodeShapes: [ex("ResearcherShape"), ex("PersonShape")],
  });

  const elements = node.children() as PropertyUIElement[];
  expect(elements).toHaveLength(2);
  expect(elements.map((element) => element.pathAsSparql()).sort()).toEqual(
    ["<http://example.org/jobTitle>", "<http://example.org/name>"].sort(),
  );
});

test("propertyUiElements exposes sh:or as a ChoiceElement alongside plain properties", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ] ;
            sh:or (
                [ sh:property [ sh:path ex:meatType ] ]
                [ sh:property [ sh:path ex:veganCertification ] ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    nodeShapes: [ex("Recipe")],
  });

  const elements = node.children();
  expect(elements).toHaveLength(2);

  const [property, choice] = elements;
  expect(property).toBeInstanceOf(PropertyUIElement);
  expect(choice).toBeInstanceOf(ChoiceElement);

  const choiceElement = choice as ChoiceElement;
  expect(choiceElement.connective).toBe("or");
  const branches = choiceElement.children();
  expect(branches).toHaveLength(2);
  expect(branches[0]).toHaveLength(1);
  expect(branches[1]).toHaveLength(1);
  expect(branches[0][0]).toBeInstanceOf(PropertyUIElement);
});

test("propertyUiElements groups multiple properties within a single sh:or branch", async () => {
  // Mirrors the "full name" vs. "first name + surname" pattern: one branch
  // can contribute more than one property.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:or (
                [ sh:property [ sh:path ex:fullName ] ]
                [
                    sh:property [ sh:path ex:firstName ] ;
                    sh:property [ sh:path ex:surname ] ;
                ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
    nodeShapes: [ex("Person")],
  });

  const elements = node.children();
  expect(elements).toHaveLength(1);

  const choiceElement = elements[0] as ChoiceElement;
  const branches = choiceElement.children();
  expect(branches[0]).toHaveLength(1);
  expect(branches[1]).toHaveLength(2);
});

test("propertyUiElements flattens sh:and branches into plain properties", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:and (
                [ sh:property [ sh:path ex:title ] ]
                [ sh:property [ sh:path ex:servings ] ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    nodeShapes: [ex("Recipe")],
  });

  const elements = node.children();
  expect(elements).toHaveLength(2);
  expect(elements[0]).toBeInstanceOf(PropertyUIElement);
  expect(elements[1]).toBeInstanceOf(PropertyUIElement);
});

test("propertyUiElements exposes sh:xone as a ChoiceElement", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:xone (
                [ sh:property [ sh:path ex:meatType ] ]
                [ sh:property [ sh:path ex:veganCertification ] ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf("", "text/turtle");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    nodeShapes: [ex("Recipe")],
  });

  const [choiceElement] = node.children() as ChoiceElement[];
  expect(choiceElement.connective).toBe("xone");
});

test("focusNode may be a BlankNode, as when walking a nested sh:node value (e.g. DetailsEditor)", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Address a sh:NodeShape ;
            sh:property [ sh:path ex:street ] .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .

        _:address1 ex:street "Dam 1" .
    `,
    "text/turtle",
  );

  const focusNode = dataGraph.getQuads(null, ex("street"))[0].subject as BlankNode;
  expect(focusNode.termType).toBe("BlankNode");

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode,
    nodeShapes: [ex("Address")],
  });

  const [property] = node.children() as PropertyUIElement[];
  expect(property.getObjects().map((term) => term.value)).toEqual(["Dam 1"]);
});

test("root sh:or with a sh:node branch (mirrors 7.7.3.f) resolves real data through ChoiceElement.children()", async () => {
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
                        sh:property [ sh:path ex:houseNumber ] ;
                    ]
                ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .

        ex:Hendrik ex:street "Dam" ; ex:houseNumber "1" .
    `,
    "text/turtle",
  );

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Hendrik"),
    nodeShapes: [ex("Person")],
  });

  const [choice] = node.children() as ChoiceElement[];
  expect(choice).toBeInstanceOf(ChoiceElement);

  const branches = choice.children();
  const structuredBranch = branches[1] as PropertyUIElement[];
  expect(structuredBranch).toHaveLength(2);
  expect(structuredBranch.map((property) => property.getObjects()[0]?.value)).toEqual(["Dam", "1"]);
});
