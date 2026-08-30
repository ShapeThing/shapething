import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, rdf } from "@/helpers/namespaces.ts";
import { generate } from "@/outputs/generate.ts";

test("generate - fakes values via faker:generator annotations, respecting sh:minCount/sh:maxCount", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix faker: <https://fakerjs.dev/> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:givenName ; sh:datatype xsd:string ; faker:generator faker:person.firstName ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:familyName ; sh:datatype xsd:string ; faker:generator faker:person.lastName ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
    seed: 1,
  });

  const [givenName] = dataGraph.getQuads(ex("person1"), ex("givenName"));
  const [familyName] = dataGraph.getQuads(ex("person1"), ex("familyName"));
  expect(givenName.object.value).toEqual(expect.any(String));
  expect(givenName.object.value.length).toBeGreaterThan(0);
  expect(familyName.object.value.length).toBeGreaterThan(0);
});

test("generate - composes a faker:generator rdf:List of calls and literal separators into one string", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix faker: <https://fakerjs.dev/> .

        ex:Recipe a sh:NodeShape ;
            sh:property [
                sh:path ex:address ;
                sh:datatype xsd:string ;
                sh:maxCount 1 ;
                sh:minCount 1 ;
                faker:generator ( faker:location.city ", " faker:location.country ) ;
            ] .
    `,
    "text/turtle",
  );

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  const [address] = dataGraph.getQuads(ex("recipe1"), ex("address"));
  expect(address.object.value).toMatch(/^.+, .+$/);
});

test("generate - fakes sensible values from sh:datatype and a property-name keyword guess, with no faker:generator anywhere in the shape", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:email ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:active ; sh:datatype xsd:boolean ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:birthDate ; sh:datatype xsd:date ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [
                sh:path ex:score ;
                sh:datatype xsd:integer ;
                sh:minInclusive 0 ;
                sh:maxInclusive 100 ;
                sh:minCount 1 ;
                sh:maxCount 1 ;
            ] .
    `,
    "text/turtle",
  );

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
    seed: 1,
  });

  const [email] = dataGraph.getQuads(ex("person1"), ex("email"));
  const [active] = dataGraph.getQuads(ex("person1"), ex("active"));
  const [birthDate] = dataGraph.getQuads(ex("person1"), ex("birthDate"));
  const [score] = dataGraph.getQuads(ex("person1"), ex("score"));

  expect(email.object.value).toContain("@");
  expect(["true", "false"]).toContain(active.object.value);
  expect(birthDate.object.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Number(score.object.value)).toBeGreaterThanOrEqual(0);
  expect(Number(score.object.value)).toBeLessThanOrEqual(100);
});

test("generate - picks a random value from sh:in", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:gender ; sh:in ( "Male" "Female" ) ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
    seed: 1,
  });

  const [gender] = dataGraph.getQuads(ex("person1"), ex("gender"));
  expect(["Male", "Female"]).toContain(gender.object.value);
});

test("generate - embeds a fresh blank node via sh:node and fakes its own properties recursively", async () => {
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

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  const [addressQuad] = dataGraph.getQuads(ex("recipe1"), ex("address"));
  expect(addressQuad.object.termType).toEqual("BlankNode");
  expect(dataGraph.getQuads(addressQuad.object, ex("street"))[0].object.value.length).toBeGreaterThan(0);
  expect(dataGraph.getQuads(addressQuad.object, ex("city"))[0].object.value.length).toBeGreaterThan(0);
});

test("generate - fakes a sh:memberShape scalar array as an rdf:List", async () => {
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

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("person1"),
    nodeShapes: [ex("Person")],
    seed: 1,
  });

  const [headQuad] = dataGraph.getQuads(ex("person1"), ex("scores"));
  const values: number[] = [];
  let current = headQuad.object;
  while (!current.equals(rdf("nil"))) {
    values.push(Number(dataGraph.getQuads(current, rdf("first"))[0].object.value));
    current = dataGraph.getQuads(current, rdf("rest"))[0].object;
  }
  expect(values).toHaveLength(3);
  for (const value of values) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(10);
  }
});

test("generate - picks one branch of a node-level sh:or and fakes only that branch's properties", async () => {
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

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  expect(dataGraph.getQuads(ex("recipe1"), ex("title"))).toHaveLength(1);
  const meatType = dataGraph.getQuads(ex("recipe1"), ex("meatType"));
  const veganCertification = dataGraph.getQuads(ex("recipe1"), ex("veganCertification"));
  expect(meatType.length + veganCertification.length).toEqual(1);
});

test("generate - picks one branch of a property-level sh:or (embedded object vs. a plain string)", async () => {
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

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  const [address] = dataGraph.getQuads(ex("recipe1"), ex("address"));
  expect(address).toBeDefined();
  if (address.object.termType === "BlankNode") {
    expect(dataGraph.getQuads(address.object, ex("street"))[0].object.value.length).toBeGreaterThan(0);
  } else {
    expect(address.object.value.length).toBeGreaterThan(0);
  }
});

test("generate - is deterministic for a given seed", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Person a sh:NodeShape ;
            sh:property [ sh:path ex:givenName ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:score ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const first = generate({ shapesGraph, focusNode: ex("person1"), nodeShapes: [ex("Person")], seed: 42 });
  const second = generate({ shapesGraph, focusNode: ex("person1"), nodeShapes: [ex("Person")], seed: 42 });

  expect(first.getQuads(ex("person1"), ex("givenName"))[0].object.value).toEqual(
    second.getQuads(ex("person1"), ex("givenName"))[0].object.value,
  );
  expect(first.getQuads(ex("person1"), ex("score"))[0].object.value).toEqual(
    second.getQuads(ex("person1"), ex("score"))[0].object.value,
  );
});

test("generate - leaves a plain resource reference unset when it can't be fabricated", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:Recipe a sh:NodeShape ;
            sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
            sh:property [ sh:path ex:author ; sh:class ex:Person ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    "text/turtle",
  );

  const dataGraph = generate({
    shapesGraph,
    focusNode: ex("recipe1"),
    nodeShapes: [ex("Recipe")],
    seed: 1,
  });

  expect(dataGraph.getQuads(ex("recipe1"), ex("title"))).toHaveLength(1);
  expect(dataGraph.getQuads(ex("recipe1"), ex("author"))).toHaveLength(0);
});
