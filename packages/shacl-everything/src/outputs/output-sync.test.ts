import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { expect, test } from "vite-plus/test";
import { ex } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { generate } from "@/outputs/generate.ts";
import { jsToRdf } from "@/outputs/js-to-rdf.ts";
import { rdfToJs } from "@/outputs/rdf-to-js.ts";
import { shaclToType } from "@/outputs/shacl-to-type.ts";
import type { BCP47, LanguageRange } from "@/types/BCP47.ts";

/**
 * The four outputs/ modules (generate.ts, rdf-to-js.ts, js-to-rdf.ts, shacl-to-type.ts) all walk
 * the same structure/ tree and key properties by the same getCodeIdentifier convention, on the
 * premise that a caller can freely mix them - generate a fixture, read it with rdfToJs, edit the
 * plain object, write it back with jsToRdf, all against the type shaclToType() generated for the
 * same shape. This file checks that premise directly, rather than each module's own behavior in
 * isolation (already covered by its own <module>.test.ts).
 */

// rdfToJs(dataGraph) -> jsToRdf(that result) -> rdfToJs(that) should reach a fixed point: reading,
// then writing what was read, then reading again must reproduce the exact same plain object. A
// shape where this doesn't hold means jsToRdf and rdfToJs have drifted apart on what one property's
// JS value looks like - which is exactly how the sh:or bug below was caught.
async function assertReadWriteReadFixedPoint(options: {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  focusNode: Quad_Subject;
  nodeShapes: Quad_Subject[];
  languages?: LanguageRange[];
  contentLanguage?: BCP47;
}): Promise<Record<string, unknown>> {
  const { shapesGraph, dataGraph, focusNode, nodeShapes, languages, contentLanguage } = options;

  const data = await rdfToJs({ shapesGraph, dataGraph, focusNode, nodeShapes, languages });
  const rewritten = jsToRdf({ shapesGraph, focusNode, nodeShapes, data, contentLanguage });
  const dataAgain = await rdfToJs({
    shapesGraph,
    dataGraph: rewritten,
    focusNode,
    nodeShapes,
    languages,
  });

  expect(dataAgain).toEqual(data);
  return data;
}

// --- jsToRdf <-> rdfToJs -----------------------------------------------------------------------

test("jsToRdf <-> rdfToJs - a property-level sh:or's sh:node branch survives a write/read round trip (regression: rdfToJs used to lose it)", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:address ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
                sh:or (
                    [ sh:node ex:AddressShape ]
                    [ sh:datatype xsd:string ]
                ) ;
            ] .

        ex:AddressShape a sh:NodeShape ;
            sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const data = { address: { street: "Main St" } };
  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data,
  });

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual(data);
});

test("jsToRdf <-> rdfToJs - a property-level sh:or's plain-datatype branch round-trips too", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:address ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
                sh:or (
                    [ sh:node ex:AddressShape ]
                    [ sh:datatype xsd:string ]
                ) ;
            ] .

        ex:AddressShape a sh:NodeShape ;
            sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const data = { address: "123 Main St" };
  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data,
  });

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual(data);
});

test("jsToRdf <-> rdfToJs - a node-level sh:or's chosen branch round-trips", async () => {
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

  const data = { title: "Beef Stew", meatType: "Beef" };
  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data,
  });

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual(data);
});

test("jsToRdf <-> rdfToJs - a sh:memberShape scalar array round-trips through the rdf:List", async () => {
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

  const data = { scores: [10, 20, 30] };
  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
    data,
  });

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
  });

  expect(result).toEqual(data);
});

test("jsToRdf <-> rdfToJs - a sh:memberShape object array (via sh:node) round-trips through the rdf:List", async () => {
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

  const data = { steps: [{ instruction: "Boil water" }, { instruction: "Add pasta" }] };
  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data,
  });

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual(data);
});

test("jsToRdf <-> rdfToJs - a rdf:langString value round-trips under the same language", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype rdf:langString ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const data = { title: "Chicken Soup" };
  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data,
    contentLanguage: "en",
  });

  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    languages: ["en"],
  });

  expect(result).toEqual(data);
});

// --- generate <-> rdfToJs <-> jsToRdf -----------------------------------------------------------

test("generate <-> rdfToJs <-> jsToRdf - fake data for scalar, array, boolean, number and date properties is a fixed point", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:tags ; sh:datatype xsd:string ; sh:minCount 2 ; sh:maxCount 4 ] ;
            sh:property [ sh:path ex:vegan ; sh:datatype xsd:boolean ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [
                sh:path ex:rating ;
                sh:datatype xsd:integer ;
                sh:minInclusive 0 ;
                sh:maxInclusive 10 ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
            ] ;
            sh:property [ sh:path ex:publishedOn ; sh:datatype xsd:date ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = await generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  await assertReadWriteReadFixedPoint({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });
});

test("generate <-> rdfToJs <-> jsToRdf - a faked embedded sh:node object is a fixed point", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:address ; sh:node ex:AddressShape ; sh:minCount 1 ; sh:maxCount 1 ] .

        ex:AddressShape a sh:NodeShape ;
            sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:city ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = await generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  const data = await assertReadWriteReadFixedPoint({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(data).toEqual({ address: { street: expect.any(String), city: expect.any(String) } });
});

test("generate <-> rdfToJs <-> jsToRdf - a faked sh:memberShape scalar array is a fixed point", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Person a sh:NodeShape ;
            sh:property [
                sh:path ex:scores ;
                sh:memberShape [ sh:datatype xsd:integer ; sh:minInclusive 0 ; sh:maxInclusive 10 ] ;
                sh:minCount 3 ;
                sh:maxCount 3 ;
            ] .
    `,
    "text/turtle",
  );

  const dataGraph = await generate({
    shapesGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
    seed: 1,
  });

  const data = await assertReadWriteReadFixedPoint({
    shapesGraph,
    dataGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
  });

  expect(data.scores).toHaveLength(3);
});

test("generate <-> rdfToJs <-> jsToRdf - a faked sh:memberShape object array (via sh:node) is a fixed point", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:steps ;
                sh:memberShape [ sh:node ex:StepShape ] ;
                sh:minCount 2 ;
                sh:maxCount 2 ;
            ] .

        ex:StepShape a sh:NodeShape ;
            sh:property [ sh:path ex:instruction ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = await generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  const data = await assertReadWriteReadFixedPoint({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(data).toEqual({
    steps: [{ instruction: expect.any(String) }, { instruction: expect.any(String) }],
  });
});

test("generate <-> rdfToJs <-> jsToRdf - a faked rdf:langString value (defaulted to 'en') is a fixed point", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype rdf:langString ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = await generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  const data = await assertReadWriteReadFixedPoint({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    languages: ["en"],
    contentLanguage: "en",
  });

  expect(data.title).toEqual(expect.any(String));
});

// --- shaclToType <-> generate/rdfToJs ------------------------------------------------------------

test("shaclToType <-> generate/rdfToJs - a plain sh:node property is typed as a nested object, matching the nested object generate()/rdfToJs() actually produce (regression: shaclToType used to type it as a bare string)", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:address ; sh:node ex:AddressShape ; sh:minCount 1 ; sh:maxCount 1 ] .

        ex:AddressShape a sh:NodeShape ;
            sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const recipeType = shaclToType({ shapesGraph }).get("Recipe") as string;
  expect(recipeType).toContain("street: string;");
  expect(recipeType).not.toContain("address: string;");

  const dataGraph = await generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });
  const data = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(data).toEqual({ address: { street: expect.any(String) } });
});

test("shaclToType <-> generate - a required scalar property's non-optional type matches its guaranteed presence in generate()'s output", async () => {
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

  const recipeType = shaclToType({ shapesGraph }).get("Recipe") as string;
  expect(recipeType).toContain("title: string;");
  expect(recipeType).not.toContain("title?:");

  const dataGraph = await generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });
  const data = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(data.title).toEqual(expect.any(String));
});

test("shaclToType <-> generate - a property without sh:maxCount 1 is typed as an array, matching generate()'s array output", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:ingredient ; sh:datatype xsd:string ; sh:minCount 2 ] .
    `,
    "text/turtle",
  );

  const recipeType = shaclToType({ shapesGraph }).get("Recipe") as string;
  expect(recipeType).toContain("ingredient: string[];");

  const dataGraph = await generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });
  const data = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(Array.isArray(data.ingredient)).toBe(true);
  expect((data.ingredient as string[]).length).toBeGreaterThanOrEqual(2);
});

// --- End-to-end: one shape, all four modules -----------------------------------------------------

test("one comprehensive shape round-trips end-to-end through generate -> rdfToJs -> jsToRdf -> rdfToJs, matching shaclToType's generated type", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:subtitle ; sh:datatype xsd:string ; sh:minCount 0 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:tags ; sh:datatype xsd:string ; sh:minCount 2 ; sh:maxCount 4 ] ;
            sh:property [ sh:path ex:vegan ; sh:datatype xsd:boolean ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [
                sh:path ex:rating ;
                sh:datatype xsd:integer ;
                sh:minInclusive 0 ;
                sh:maxInclusive 10 ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
            ] ;
            sh:property [ sh:path ex:publishedOn ; sh:datatype xsd:date ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:description ; sh:datatype rdf:langString ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:author ; sh:node ex:PersonShape ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [
                sh:path ex:scores ;
                sh:memberShape [ sh:datatype xsd:integer ; sh:minInclusive 0 ; sh:maxInclusive 10 ] ;
                sh:minCount 3 ;
                sh:maxCount 3 ;
            ] ;
            sh:property [
                sh:path ex:steps ;
                sh:memberShape [ sh:node ex:StepShape ] ;
                sh:minCount 2 ;
                sh:maxCount 2 ;
            ] .

        ex:PersonShape a sh:NodeShape ;
            sh:property [ sh:path ex:name ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .

        ex:StepShape a sh:NodeShape ;
            sh:property [ sh:path ex:instruction ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  // shaclToType's own declared shape for the fixture above - every assertion below checks the
  // actual generate()/rdfToJs()/jsToRdf() data against what this type promises, so a future change
  // that lets any one of the four modules drift from the others shows up here.
  const recipeType = shaclToType({ shapesGraph }).get("Recipe") as string;
  expect(recipeType).toContain("title: string;");
  expect(recipeType).toContain("subtitle?: string;");
  expect(recipeType).toContain("tags: string[];");
  expect(recipeType).toContain("vegan: boolean;");
  expect(recipeType).toContain("rating: number;");
  expect(recipeType).toContain("publishedOn: Date;");
  expect(recipeType).toContain("description: string;");
  expect(recipeType).toContain("scores?: number[];");
  expect(recipeType).toContain("name: string;"); // nested inside author's own embedded object type
  expect(recipeType).toContain("instruction: string;"); // nested inside steps' member object type

  const generatedGraph = await generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 7,
  });

  const data = await rdfToJs({
    shapesGraph,
    dataGraph: generatedGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    languages: ["en"],
  });

  // Structurally matches what shaclToType() promised: every required key present with the right
  // JS type, an embedded sh:node object, and both flavors of sh:memberShape array (scalar/object).
  expect(data).toMatchObject({
    title: expect.any(String),
    vegan: expect.any(Boolean),
    rating: expect.any(Number),
    publishedOn: expect.any(Date),
    description: expect.any(String),
    author: { name: expect.any(String) },
    scores: [expect.any(Number), expect.any(Number), expect.any(Number)],
    steps: [{ instruction: expect.any(String) }, { instruction: expect.any(String) }],
  });
  expect(Array.isArray(data.tags)).toBe(true);
  expect((data.tags as string[]).length).toBeGreaterThanOrEqual(2);
  expect((data.tags as string[]).length).toBeLessThanOrEqual(4);
  for (const tag of data.tags as string[]) expect(tag).toEqual(expect.any(String));

  // rdf -> js -> rdf -> js -> rdf: writing `data` back out on a fresh focus node and reading it
  // again must reproduce the exact same object - generate()'s fake data is only trustworthy as a
  // fixture if jsToRdf/rdfToJs treat it as a stable fixed point, not just a one-way read.
  const rewrittenGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe2"),
    nodeShapes: [ex("Recipe")],
    data,
    contentLanguage: "en",
  });
  const dataAgain = await rdfToJs({
    shapesGraph,
    dataGraph: rewrittenGraph,
    focusNode: ex("recipe2"),
    nodeShapes: [ex("Recipe")],
    languages: ["en"],
  });

  expect(dataAgain).toEqual(data);
});
