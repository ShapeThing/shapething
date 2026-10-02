import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { jsToRdf } from "@/outputs/js-to-rdf.ts";
import { ex, rdf, xsd } from "@/helpers/namespaces.ts";

test("jsToRdf - writes a required scalar string property", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { title: "Chicken Soup" },
  });

  const quads = dataGraph.getQuads(ex("recipe1"), ex("title"));
  expect(quads).toHaveLength(1);
  expect(quads[0].object.value).toEqual("Chicken Soup");
  expect((quads[0].object as { datatype: { value: string } }).datatype.value).toEqual(
    xsd("string").value,
  );
});

test("jsToRdf - writes an array value as multiple triples", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:ingredient ; sh:datatype xsd:string ] .
    `,
    "text/turtle",
  );

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { ingredient: ["Chicken", "Salt", "Pepper"] },
  });

  const values = dataGraph.getQuads(ex("recipe1"), ex("ingredient")).map((q) => q.object.value);
  expect(values.sort()).toEqual(["Chicken", "Pepper", "Salt"]);
});

test("jsToRdf - formats number and boolean values with the declared datatype", async () => {
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

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { servings: 4, vegan: true },
  });

  expect(dataGraph.getQuads(ex("recipe1"), ex("servings"))[0].object.value).toEqual("4");
  expect(dataGraph.getQuads(ex("recipe1"), ex("vegan"))[0].object.value).toEqual("true");
});

test("jsToRdf - writes an xsd:date value formatted from a JS Date", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:publishedOn ; sh:datatype xsd:date ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { publishedOn: new Date(Date.UTC(2024, 2, 15)) },
  });

  expect(dataGraph.getQuads(ex("recipe1"), ex("publishedOn"))[0].object.value).toEqual(
    "2024-03-15",
  );
});

test("jsToRdf - writes a string value as an IRI reference when the property is resource-shaped", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:author ; sh:class ex:Person ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { author: "http://example.org/person1" },
  });

  const [quad] = dataGraph.getQuads(ex("recipe1"), ex("author"));
  expect(quad.object.termType).toEqual("NamedNode");
  expect(quad.object.value).toEqual("http://example.org/person1");
});

test("jsToRdf - embeds a plain object value as a fresh blank node via the property's sh:node", async () => {
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

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { address: { street: "Main St", city: "Springfield" } },
  });

  const [addressQuad] = dataGraph.getQuads(ex("recipe1"), ex("address"));
  expect(addressQuad.object.termType).toEqual("BlankNode");
  expect(dataGraph.getQuads(addressQuad.object, ex("street"))[0].object.value).toEqual("Main St");
  expect(dataGraph.getQuads(addressQuad.object, ex("city"))[0].object.value).toEqual("Springfield");
});

test("jsToRdf - writes an rdf:langString value tagged with the given contentLanguage", async () => {
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

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { title: "Chicken Soup" },
    contentLanguage: "en-GB",
  });

  const [quad] = dataGraph.getQuads(ex("recipe1"), ex("title"));
  expect(quad.object.value).toEqual("Chicken Soup");
  expect((quad.object as { language: string }).language).toEqual("en-GB");
  expect((quad.object as { datatype: { value: string } }).datatype.value).toEqual(
    rdf("langString").value,
  );
});

test("jsToRdf - throws when writing an rdf:langString property without a contentLanguage", async () => {
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

  expect(() =>
    jsToRdf({
      shapesGraph,
      focusNode: ex("recipe1"),
      nodeShapes: [ex("Recipe")],
      data: { title: "Chicken Soup" },
    }),
  ).toThrow(/contentLanguage/);
});

test("jsToRdf - writes a sh:memberShape scalar array as an rdf:List", async () => {
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

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
    data: { scores: [10, 20, 30] },
  });

  const [headQuad] = dataGraph.getQuads(ex("person1"), ex("scores"));
  const values: string[] = [];
  let current = headQuad.object;
  while (!current.equals(rdf("nil"))) {
    values.push(dataGraph.getQuads(current, rdf("first"))[0].object.value);
    current = dataGraph.getQuads(current, rdf("rest"))[0].object;
  }
  expect(values).toEqual(["10", "20", "30"]);
});

test("jsToRdf - writes a sh:memberShape object array (via sh:node) as an rdf:List of blank nodes", async () => {
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

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { steps: [{ instruction: "Boil water" }, { instruction: "Add pasta" }] },
  });

  const [headQuad] = dataGraph.getQuads(ex("recipe1"), ex("steps"));
  const instructions: string[] = [];
  let current = headQuad.object;
  while (!current.equals(rdf("nil"))) {
    const member = dataGraph.getQuads(current, rdf("first"))[0].object;
    instructions.push(dataGraph.getQuads(member, ex("instruction"))[0].object.value);
    current = dataGraph.getQuads(current, rdf("rest"))[0].object;
  }
  expect(instructions).toEqual(["Boil water", "Add pasta"]);
});

test("jsToRdf - picks the sh:or branch whose keys best match the given data", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
            sh:or (
                [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:maxCount 1 ] ]
                [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:maxCount 1 ] ]
            ) .
    `,
    "text/turtle",
  );

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { title: "Beef Stew", meatType: "Beef" },
  });

  expect(dataGraph.getQuads(ex("recipe1"), ex("title"))[0].object.value).toEqual("Beef Stew");
  expect(dataGraph.getQuads(ex("recipe1"), ex("meatType"))[0].object.value).toEqual("Beef");
  expect(dataGraph.getQuads(ex("recipe1"), ex("veganCertification"))).toHaveLength(0);
});

test("jsToRdf - writes a plain-object value into the sh:node branch of a property-level sh:or", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:address ;
                sh:maxCount 1 ;
                sh:or (
                    [ sh:node ex:AddressShape ]
                    [ sh:datatype xsd:string ]
                ) ;
            ] .

        ex:AddressShape a sh:NodeShape ;
            sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data: { address: { street: "Main St" } },
  });

  const [addressQuad] = dataGraph.getQuads(ex("recipe1"), ex("address"));
  expect(addressQuad.object.termType).toEqual("BlankNode");
  expect(dataGraph.getQuads(addressQuad.object, ex("street"))[0].object.value).toEqual("Main St");
});

test("jsToRdf - round-trips through rdfToJs for a nested-object shape", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:address ; sh:node ex:AddressShape ; sh:maxCount 1 ] .

        ex:AddressShape a sh:NodeShape ;
            sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const data = { title: "Chicken Soup", address: { street: "Main St" } };
  const dataGraph = jsToRdf({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    data,
  });

  const { rdfToJs } = await import("@/outputs/rdf-to-js.ts");
  const result = await rdfToJs({
    shapesGraph,
    dataGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
  });

  expect(result).toEqual(data);
});
