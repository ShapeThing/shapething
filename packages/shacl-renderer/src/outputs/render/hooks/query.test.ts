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
  unwrapSoleService,
} from "./query.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

const createShape = async (shapesTurtle: string, dataTurtle: string) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    widgetRegistry: defaultWidgets,
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

  expect(results[0]?.classifications?.[0]?.term.value).toBe(ex("transport").value);
  expect(results[0]?.classifications?.[0]?.color).toBe("#22c55e");
});

// buildSearchQuery/buildRoleLookupQuery return one row per ?classification rather than sampling
// one - toResolvedTerms folds those back into a single result per value, keeping every scheme.
test("searchInstances()/fetchOptions() keep every ClassificationRole value, each colored off its own rdf:type", async () => {
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
      ex:p1 a ex:Concept ; ex:name "Bicycle" ; ex:inScheme ex:transport, ex:sport .
      ex:p2 a ex:Concept ; ex:name "Bicycle bell" ; ex:inScheme ex:transport .
      ex:transport a ex:Scheme ; rdfs:label "Transport"@en, "Vervoer"@nl ; ex:swatch "#22c55e" .
      ex:sport a ex:Scheme ; rdfs:label "Sport" .
    `,
  );

  const byLabel = (classifications: { label: string; color?: string }[] = []) =>
    classifications.map(({ label, color }) => ({ label, color })).toSorted((a, b) =>
      a.label.localeCompare(b.label),
    );

  const searched = await searchInstances(shape, "bicycle");
  // Still one result per value, in ranked order - p1's two schemes don't duplicate it.
  expect(searched.map((result) => result.iri.value)).toEqual([ex("p1").value, ex("p2").value]);
  expect(searched[0]?.classifications).toHaveLength(2);
  expect(byLabel(searched[0]?.classifications).map(({ color }) => color)).toEqual([
    undefined,
    "#22c55e",
  ]);
  expect(searched[1]?.classifications).toHaveLength(1);

  const [fetched] = await fetchOptions(shape, [ex("p1")]);
  expect(fetched?.classifications).toHaveLength(2);
  expect(byLabel(fetched?.classifications)[0]).toEqual({ label: "Sport", color: undefined });
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

  expect(results[0]?.classifications?.[0]?.term.value).toBe(ex("transport").value);
  expect(results[0]?.classifications?.[0]?.color).toBeUndefined();
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

// Comunica's Bindings iteration order follows its join order, not the SELECT clause - a nested
// ClassificationRole optional used to put ?classification ahead of ?value, so each result was
// keyed on its classification IRI instead of the instance itself.
test("searchInstances()/fetchOptions() key results on ?value, not on whichever variable a ClassificationRole binds first", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Chef ; sh:node ex:ChefShape .
      ex:ChefShape sh:property ex:nameProperty, ex:cuisineProperty, ex:imageProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
      ex:cuisineProperty sh:path ex:cuisine ; shui:propertyRole shui:ClassificationRole .
      ex:imageProperty sh:path ex:image ; shui:propertyRole shui:DepictionRole .
    `,
    `
      ex:gordon a ex:Chef ; ex:name "Gordon" ; ex:cuisine ex:British ; ex:image <http://example.org/gordon.jpg> .
      ex:British rdfs:label "British" .
    `,
  );

  const [searched] = await searchInstances(shape, "gordon");
  expect(searched?.iri.value).toBe(ex("gordon").value);
  expect(searched?.depiction?.value).toBe("http://example.org/gordon.jpg");

  const [fetched] = await fetchOptions(shape, [ex("gordon")]);
  expect(fetched?.iri.value).toBe(ex("gordon").value);
  expect(fetched?.label).toBe("Gordon");
  expect(fetched?.classifications?.[0]?.label).toBe("British");
  expect(fetched?.depiction?.value).toBe("http://example.org/gordon.jpg");
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

test("fetchOptions() keys results on ?value even when a ClassificationRole IRI is projected alongside depiction/description", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Chef ; sh:node ex:ChefShape .
      ex:ChefShape sh:property
        [ sh:path ex:name ; shui:propertyRole shui:LabelRole ],
        [ sh:path ex:image ; shui:propertyRole shui:DepictionRole ],
        [ sh:path ex:bio ; shui:propertyRole shui:DescriptionRole ],
        [ sh:path ex:cuisine ; shui:propertyRole shui:ClassificationRole ] .
    `,
    `
      ex:French rdfs:label "French" .
      ex:julia a ex:Chef ; ex:name "Julia Child" ; ex:image <http://example.org/julia.jpg> ;
        ex:bio "Mastered the art of French cooking." ; ex:cuisine ex:French .
    `,
  );

  const [result] = await fetchOptions(shape, [ex("julia")]);

  expect(result.iri.value).toBe(ex("julia").value);
  expect(result.label).toBe("Julia Child");
  expect(result.classifications?.[0]?.label).toBe("French");
});

test("unwrapSoleService() strips a SERVICE block that is the whole WHERE body", () => {
  const unwrapped = unwrapSoleService(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?value WHERE {
      # a "}" in a comment
      SERVICE <https://example.com/sparql> {
        ?value rdfs:label "a { b" .
        FILTER NOT EXISTS { ?value rdfs:comment ?comment }
      }
    }
    ORDER BY ?value
  `);

  expect(unwrapped?.endpoint).toBe("https://example.com/sparql");
  expect(unwrapped?.query).not.toContain("SERVICE");
  expect(unwrapped?.query).toContain(`?value rdfs:label "a { b"`);
  expect(unwrapped?.query).toContain("FILTER NOT EXISTS { ?value rdfs:comment ?comment }");
  expect(unwrapped?.query).toMatch(/}\s*ORDER BY \?value\s*$/);
});

test("unwrapSoleService() leaves a SERVICE alongside local patterns (or SILENT) alone", () => {
  expect(
    unwrapSoleService(`SELECT ?value WHERE {
      ?value a <http://example.org/Local> .
      SERVICE <https://example.com/sparql> { ?value ?p ?o }
    }`),
  ).toBeUndefined();
  expect(
    unwrapSoleService(`SELECT ?value WHERE {
      SERVICE <https://example.com/sparql> { ?value ?p ?o }
      ?value a <http://example.org/Local> .
    }`),
  ).toBeUndefined();
  expect(
    unwrapSoleService(`SELECT ?value WHERE { SERVICE SILENT <https://example.com/sparql> { ?value ?p ?o } }`),
  ).toBeUndefined();
});

const islandShapes = `
  ex:property1 a sh:PropertyShape ; sh:class ex:Island .
  ex:IslandShape a sh:NodeShape ; sh:targetClass ex:Island ; sh:property
    [ sh:path ex:name ; shui:propertyRole shui:LabelRole ],
    [ sh:path ex:about ; shui:propertyRole shui:DescriptionRole ],
    [
      sh:path ex:islandIcon ;
      sh:defaultValue <http://example.org/icons/island.svg> ;
      shui:propertyRole shui:IconRole
    ] .
`;

const islandData = `
  ex:texel a ex:Island ; ex:name "Texel" .
  ex:krakatoa a ex:Island ; ex:name "Krakatoa" ; ex:islandIcon <http://example.org/icons/volcano.svg> .
  ex:surtsey a ex:Island ; ex:name "Surtsey" ;
    ex:islandIcon "http://example.org/icons/new.svg"^^xsd:anyURI ;
    ex:about "<p>A <b>new</b> island.</p>"^^rdf:HTML .
`;

test("fetchOptions() resolves a value's own IconRole value (IRI or xsd:anyURI), else the sh:defaultValue icon", async () => {
  const shape = await createShape(islandShapes, islandData);

  const results = await fetchOptions(shape, [ex("texel"), ex("krakatoa"), ex("surtsey")]);
  const iconOf = (name: string) => results.find((r) => r.label === name)?.icon?.value;

  expect(iconOf("Texel")).toBe("http://example.org/icons/island.svg");
  expect(iconOf("Krakatoa")).toBe("http://example.org/icons/volcano.svg");
  expect(iconOf("Surtsey")).toBe("http://example.org/icons/new.svg");
});

test("searchInstances() resolves IconRole icons and flattens an rdf:HTML DescriptionRole value to text", async () => {
  const shape = await createShape(islandShapes, islandData);

  const results = await searchInstances(shape, "e");
  const surtsey = results.find((r) => r.label === "Surtsey");
  const texel = results.find((r) => r.label === "Texel");

  expect(surtsey?.icon?.value).toBe("http://example.org/icons/new.svg");
  expect(surtsey?.description).toBe("A new island.");
  expect(texel?.icon?.value).toBe("http://example.org/icons/island.svg");
});
