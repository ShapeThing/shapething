import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { rdfToJs } from "@/outputs/rdf-to-js.ts";
import { ex } from "@/helpers/namespaces.ts";

test("rdfToJs - reads a required scalar string property", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:recipe1 ex:title "Chicken Soup" .
    `,
    "text/turtle",
  );

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual({ title: "Chicken Soup" });
});

test("rdfToJs - omits a property with no value entirely", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:subtitle ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(`@prefix ex: <http://example.org/> . ex:recipe1 a ex:Recipe .`, "text/turtle");

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual({});
});

test("rdfToJs - reads properties without maxCount 1 as an array", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:ingredient ; sh:datatype xsd:string ; sh:minCount 1 ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:recipe1 ex:ingredient "Chicken", "Salt", "Pepper" .
    `,
    "text/turtle",
  );

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect((result.ingredient as string[]).sort()).toEqual(["Chicken", "Pepper", "Salt"]);
});

test("rdfToJs - coerces xsd:integer and xsd:boolean to number and boolean", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:servings ; sh:datatype xsd:integer ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:vegan ; sh:datatype xsd:boolean ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        ex:recipe1 ex:servings "4"^^xsd:integer ; ex:vegan "true"^^xsd:boolean .
    `,
    "text/turtle",
  );

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual({ servings: 4, vegan: true });
});

test("rdfToJs - reads a NamedNode value as a plain IRI string, not a nested object", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:author ; sh:class ex:Person ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `@prefix ex: <http://example.org/> . ex:recipe1 ex:author ex:person1 .`,
    "text/turtle",
  );

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual({ author: "http://example.org/person1" });
});

test("rdfToJs - recurses into a blank-node value via the property's sh:node", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:address ; sh:node ex:AddressShape ; sh:maxCount 1 ] .

        ex:AddressShape a sh:NodeShape ;
            sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:city ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:recipe1 ex:address [ ex:street "Main St" ; ex:city "Springfield" ] .
    `,
    "text/turtle",
  );

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual({ address: { street: "Main St", city: "Springfield" } });
});

test("rdfToJs - collapses a langString property to a single string via the best language match", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype rdf:langString ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `@prefix ex: <http://example.org/> . ex:recipe1 ex:title "English"@en, "Dutch"@nl .`,
    "text/turtle",
  );

  const englishResult = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    languages: ["en"],
  });
  expect(englishResult).toEqual({ title: "English" });

  const dutchResult = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    languages: ["nl"],
  });
  expect(dutchResult).toEqual({ title: "Dutch" });
});

test("rdfToJs - reads a sh:memberShape scalar list as an array of coerced values", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:scores ; sh:memberShape [ sh:datatype xsd:integer ] ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        ex:person1 ex:scores ( "10"^^xsd:integer "20"^^xsd:integer "30"^^xsd:integer ) .
    `,
    "text/turtle",
  );

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
  });

  expect(result).toEqual({ scores: [10, 20, 30] });
});

test("rdfToJs - reads a sh:memberShape object list (via sh:node) as an array of nested objects", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:steps ; sh:memberShape [ sh:node ex:StepShape ] ] .

        ex:StepShape a sh:NodeShape ;
            sh:property [ sh:path ex:instruction ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:recipe1 ex:steps ( [ ex:instruction "Boil water" ] [ ex:instruction "Add pasta" ] ) .
    `,
    "text/turtle",
  );

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual({
    steps: [{ instruction: "Boil water" }, { instruction: "Add pasta" }],
  });
});

test("rdfToJs - merges the sh:or branch the focus node conforms to into the result", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:or (
                [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
                [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
            ) .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:recipe1 ex:title "Beef Stew" ; ex:meatType "Beef" .
    `,
    "text/turtle",
  );

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual({ title: "Beef Stew", meatType: "Beef" });
});
