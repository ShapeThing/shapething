import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import {
  fetchOptions,
  insertValuesClause,
  runQuery,
  searchInstances,
  substituteSearchParameters,
} from "./query.ts";

const createShape = async (shapesTurtle: string, dataTurtle: string) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Subject"),
    propertyShapes: [ex("property1")],
  });
};

test("searchInstances() ranks a label+IRI match above a label-only match above an IRI-only match", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Person ; sh:node ex:PersonShape .
      ex:PersonShape sh:property ex:nameProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
    `,
    `
      ex:p1 a ex:Person ; ex:name "Ali Ambulance" .
      ex:ali-street-42 a ex:Person ; ex:name "Bob" .
      ex:both-ali a ex:Person ; ex:name "Ali" .
      ex:unrelated a ex:Person ; ex:name "Carol" .
    `,
  );

  const results = await searchInstances(shape, "ali");

  expect(results.map((result) => result.iri.value)).toEqual([
    ex("both-ali").value,
    ex("p1").value,
    ex("ali-street-42").value,
  ]);
});

test("searchInstances() falls back to IRI-only matching when there is no LabelRole", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:class ex:Person .`,
    `
      ex:ali-street-42 a ex:Person .
      ex:unrelated a ex:Person .
    `,
  );

  const results = await searchInstances(shape, "ali");

  expect(results.map((result) => result.iri.value)).toEqual([ex("ali-street-42").value]);
});

test("searchInstances() resolves a ClassificationRole value's own st:ColorRole, off the classification's own rdf:type rather than propertyShape's", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Concept ; sh:node ex:ConceptShape .
      ex:ConceptShape sh:property ex:nameProperty, ex:schemeProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
      ex:schemeProperty sh:path ex:inScheme ; shui:propertyRole shui:ClassificationRole .
      ex:SchemeShape a sh:NodeShape ; sh:targetClass ex:Scheme ;
        sh:property [ sh:path ex:swatch ; shui:propertyRole st:ColorRole ] .
    `,
    `
      ex:p1 a ex:Concept ; ex:name "Bicycle" ; ex:inScheme ex:transport .
      ex:transport a ex:Scheme ; ex:swatch "#22c55e" .
    `,
  );

  const results = await searchInstances(shape, "bicycle");

  expect(results[0]?.classification?.term.value).toBe(ex("transport").value);
  expect(results[0]?.classification?.color).toBe("#22c55e");
});

test("searchInstances() leaves classification.color undefined when the classification's own class declares no st:ColorRole", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Concept ; sh:node ex:ConceptShape .
      ex:ConceptShape sh:property ex:schemeProperty .
      ex:schemeProperty sh:path ex:inScheme ; shui:propertyRole shui:ClassificationRole .
    `,
    `
      ex:p1 a ex:Concept ; ex:inScheme ex:transport .
      ex:transport a ex:Scheme .
    `,
  );

  const results = await searchInstances(shape, "p1");

  expect(results[0]?.classification?.term.value).toBe(ex("transport").value);
  expect(results[0]?.classification?.color).toBeUndefined();
});

test("fetchOptions() resolves every requested iri's label in a single batched query", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Person ; sh:node ex:PersonShape .
      ex:PersonShape sh:property ex:nameProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
    `,
    `
      ex:p1 a ex:Person ; ex:name "Ali" .
      ex:p2 a ex:Person ; ex:name "Bob" .
      ex:p3 a ex:Person ; ex:name "Carol" .
    `,
  );

  const results = await fetchOptions(shape, [ex("p1"), ex("p3")]);

  expect(new Set(results.map((result) => result.iri.value))).toEqual(
    new Set([ex("p1").value, ex("p3").value]),
  );
  expect(results.find((result) => result.iri.value === ex("p1").value)?.label).toBe("Ali");
  expect(results.find((result) => result.iri.value === ex("p3").value)?.label).toBe("Carol");
});

test("fetchOptions() returns nothing for an empty iri list", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:class ex:Person .`, ``);

  expect(await fetchOptions(shape, [])).toEqual([]);
});

test("fetchOptions() keeps concurrent calls on the same shape scoped to their own requested iris", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Person ; sh:node ex:PersonShape .
      ex:PersonShape sh:property ex:nameProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
    `,
    `
      ex:p1 a ex:Person ; ex:name "Ali" .
      ex:p2 a ex:Person ; ex:name "Bob" .
      ex:p3 a ex:Person ; ex:name "Carol" .
      ex:p4 a ex:Person ; ex:name "Dee" .
    `,
  );

  // Two calls issued back to back (no await between them) on the same shape fall into the same
  // ROLE_LOOKUP_BATCH_DELAY_MS window and get merged into one query - each call must still resolve
  // to exactly its own requested iris, never the other call's.
  const [first, second] = await Promise.all([
    fetchOptions(shape, [ex("p1"), ex("p2")]),
    fetchOptions(shape, [ex("p3"), ex("p4")]),
  ]);

  expect(first.map((result) => result.iri.value)).toEqual([ex("p1").value, ex("p2").value]);
  expect(first.map((result) => result.label)).toEqual(["Ali", "Bob"]);
  expect(second.map((result) => result.iri.value)).toEqual([ex("p3").value, ex("p4").value]);
  expect(second.map((result) => result.label)).toEqual(["Carol", "Dee"]);
});

test("runQuery() can FILTER on a geof: GeoSPARQL relation function, proving the extension function is actually wired into the Comunica engine (not just unit-tested in isolation)", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:class ex:City .`,
    `
      ex:paris a ex:City ; ex:location "POINT (2.35 48.85)"^^geosparql:wktLiteral .
      ex:tokyo a ex:City ; ex:location "POINT (139.69 35.68)"^^geosparql:wktLiteral .
    `,
  );

  const results = await runQuery(
    `${queryPrefixes}
     select ?value where {
       ?value a ex:City ; ex:location ?location .
       filter(geof:sfWithin(?location, "POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))"^^geosparql:wktLiteral))
     }`,
    shape,
  );

  expect(results.map((result) => result.term.value)).toEqual([ex("paris").value]);
});

test("substituteSearchParameters() replaces both $-prefixed and ?-prefixed forms of the same query", () => {
  const dollarForm = substituteSearchParameters(
    "SELECT ?value WHERE { ?value rdfs:label $searchTerm, $uiLanguage }",
    "hello",
    "en-GB",
  );
  expect(dollarForm).toContain('"hello"');
  expect(dollarForm).toContain('"en-GB"');

  const questionMarkForm = substituteSearchParameters(
    "SELECT ?value WHERE { ?value rdfs:label ?searchTerm, ?uiLanguage }",
    "hello",
    "en-GB",
  );
  expect(questionMarkForm).toContain('"hello"');
  expect(questionMarkForm).toContain('"en-GB"');

  const mixedForm = substituteSearchParameters(
    "SELECT ?value WHERE { ?value rdfs:label ?searchTerm, $uiLanguage }",
    "hello",
    "en-GB",
  );
  expect(mixedForm).toContain('"hello"');
  expect(mixedForm).toContain('"en-GB"');
});

test("insertValuesClause() binds every candidate in one VALUES clause, inside the SERVICE block when there is one", () => {
  const federated = insertValuesClause(
    `PREFIX ex: <http://example.org/>
     SELECT DISTINCT ?value1 WHERE {
       SERVICE <https://example.com/sparql> {
         ?value1 a ex:Person .
       }
     }`,
    "value1",
    [ex("a"), ex("b")],
  );
  const serviceBody = federated.slice(federated.indexOf("SERVICE"));
  expect(serviceBody).toContain(`VALUES ?value1 { <${ex("a").value}> <${ex("b").value}> }`);

  const local = insertValuesClause(
    `PREFIX ex: <http://example.org/> SELECT ?value WHERE { ?value a ex:Person }`,
    "value",
    [ex("a"), ex("b")],
  );
  expect(local).toContain(`VALUES ?value { <${ex("a").value}> <${ex("b").value}> }`);
});
