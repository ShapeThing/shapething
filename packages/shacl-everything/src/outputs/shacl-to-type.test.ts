import { expect, test } from "vite-plus/test";
import { parseRdf } from "../helpers/rdf.ts";
import { shaclToType } from "./shacl-to-type.ts";

test("generates a type for a required scalar property", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:title ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
            ] .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  expect(types.has("Recipe")).toBe(true);
  const recipe = types.get("Recipe") as string;
  expect(recipe).toContain("export type Recipe");
  expect(recipe).toContain("title: string;");
  expect(recipe).not.toContain("title?:");
  expect(recipe).not.toContain("title: string[]");
});

test("marks a property with sh:minCount 0 as optional", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:subtitle ;
                sh:datatype xsd:string ;
                sh:minCount 0 ;
                sh:maxCount 1 ;
            ] .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  const recipe = types.get("Recipe") as string;
  expect(recipe).toContain("subtitle?: string;");
});

test("renders properties without maxCount 1 as arrays", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:ingredient ;
                sh:datatype xsd:string ;
                sh:minCount 1 ;
            ] .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  const recipe = types.get("Recipe") as string;
  expect(recipe).toContain("ingredient: string[];");
});

test("maps xsd:integer and xsd:boolean datatypes to number and boolean", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:servings ;
                sh:datatype xsd:integer ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
            ] ;
            sh:property [
                sh:path ex:vegan ;
                sh:datatype xsd:boolean ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
            ] .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  const recipe = types.get("Recipe") as string;
  expect(recipe).toContain("servings: number;");
  expect(recipe).toContain("vegan: boolean;");
});

test("generates one type per node shape, keyed by local name", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:maxCount 1 ] .

        ex:Ingredient a sh:NodeShape ;
            sh:property [ sh:path ex:name ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  expect([...types.keys()].sort()).toEqual(["Ingredient", "Recipe"]);
});

test("honors sh:codeIdentifier over the shape's local name", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ex:Recipe a sh:NodeShape ;
            sh:codeIdentifier "ChickenSoupRecipe" .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  expect(types.has("ChickenSoupRecipe")).toBe(true);
  expect(types.has("Recipe")).toBe(false);
});

test("falls back to sh:name when sh:codeIdentifier is absent", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ex:Recipe a sh:NodeShape ;
            sh:name "RecipeType" .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  expect(types.has("RecipeType")).toBe(true);
  expect(types.has("Recipe")).toBe(false);
});

test("falls back to the local name of a hash-delimited shape IRI", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/vocab#> .

        ex:Recipe a sh:NodeShape .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  expect(types.has("Recipe")).toBe(true);
});

test("renders sh:or as a union of the branches' object types", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:or (
                [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
                [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
            ) .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  const recipe = types.get("Recipe") as string;
  expect(recipe).toBe(
    "export type Recipe = { meatType: string } | { veganCertification: string };\n",
  );
});

test("groups multiple properties within a single sh:or branch into one object type", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Person a sh:NodeShape ;
            sh:or (
                [ sh:property [ sh:path ex:fullName ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
                [
                    sh:property [ sh:path ex:firstName ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
                    sh:property [ sh:path ex:surname ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
                ]
            ) .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  const person = types.get("Person") as string;
  expect(person).toBe(
    "export type Person =\n  { fullName: string } | { firstName: string; surname: string };\n",
  );
});

test("intersects plain properties with a sh:or union on the same node shape", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
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

  const types = await shaclToType({ shapesGraph });

  const recipe = types.get("Recipe") as string;
  expect(recipe).toBe(
    "export type Recipe = {\n  title: string;\n} & ({ meatType: string } | { veganCertification: string });\n",
  );
});

test("renders sh:xone as a mutually-exclusive union, unlike sh:or", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:xone (
                [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
                [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
            ) .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  const recipe = types.get("Recipe") as string;
  expect(recipe).toBe(
    "export type Recipe =\n  | { meatType: string; veganCertification?: never }\n  | { veganCertification: string; meatType?: never };\n",
  );
});

test("marks every sibling key as never for each branch of a three-way sh:xone", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:xone (
                [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
                [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
                [ sh:property [ sh:path ex:halalCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
            ) .
    `,
    "text/turtle",
  );

  const types = await shaclToType({ shapesGraph });

  const recipe = types.get("Recipe") as string;
  expect(recipe).toBe(
    "export type Recipe =\n" +
      "  | { meatType: string; veganCertification?: never; halalCertification?: never }\n" +
      "  | { veganCertification: string; meatType?: never; halalCertification?: never }\n" +
      "  | {\n" +
      "      halalCertification: string;\n" +
      "      meatType?: never;\n" +
      "      veganCertification?: never;\n" +
      "    };\n",
  );
});
