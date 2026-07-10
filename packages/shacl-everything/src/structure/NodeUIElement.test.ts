import { expect, test } from "vite-plus/test";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

test("NodeUIElement", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
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
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .

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

test("propertyUiElements does not dedupe an equal path declared on separate node shapes", async () => {
  // Grouping happens per node shape (each sh:property list gets its own
  // Map), so the same path repeated across two node shapes that both
  // apply to the focus node - e.g. two branches of a sh:or - still
  // produces one PropertyUIElement per node shape rather than one overall.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

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

  expect(node.children()).toHaveLength(2);
});

test("propertyUiElements exposes sh:or as a ChoiceElement alongside plain properties", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .

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
