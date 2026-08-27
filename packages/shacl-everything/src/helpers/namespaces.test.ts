import { expect, test } from "vite-plus/test";
import {
  dash,
  ex,
  faker,
  owl,
  prefixes,
  queryPrefixes,
  rdf,
  rdfs,
  sh,
  shui,
  skos,
  st,
  xsd,
} from "@/helpers/namespaces.ts";

test("namespaces - build IRIs by appending the local name to the base IRI", () => {
  expect(rdf("type").value).toEqual("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
  expect(rdfs("label").value).toEqual("http://www.w3.org/2000/01/rdf-schema#label");
  expect(ex("Alice").value).toEqual("http://example.org/Alice");
  expect(sh("PropertyShape").value).toEqual("http://www.w3.org/ns/shacl#PropertyShape");
  expect(shui("BooleanEditor").value).toEqual("http://www.w3.org/ns/shacl-ui/BooleanEditor");
  expect(dash("StringEditor").value).toEqual("http://datashapes.org/dash#StringEditor");
  expect(xsd("string").value).toEqual("http://www.w3.org/2001/XMLSchema#string");
  expect(owl("Class").value).toEqual("http://www.w3.org/2002/07/owl#Class");
  expect(faker("name").value).toEqual("https://fakerjs.dev/name");
  expect(skos("Concept").value).toEqual("http://www.w3.org/2004/02/skos/core#Concept");
  expect(st("CollapsiblePropertyGroup").value).toEqual(
    "http://shapething/CollapsiblePropertyGroup",
  );
});

test("namespaces - produces named nodes", () => {
  expect(rdf("type").termType).toEqual("NamedNode");
});

test("prefixes - maps every namespace alias to its base IRI", () => {
  expect(prefixes).toEqual({
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    ex: "http://example.org/",
    sh: "http://www.w3.org/ns/shacl#",
    dash: "http://datashapes.org/dash#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    faker: "https://fakerjs.dev/",
    skos: "http://www.w3.org/2004/02/skos/core#",
    shui: "http://www.w3.org/ns/shacl-ui/",
    st: "http://shapething/",
    foaf: "http://xmlns.com/foaf/0.1/",
    dc: "http://purl.org/dc/elements/1.1/",
    dcterms: "http://purl.org/dc/terms/",
    dcat: "http://www.w3.org/ns/dcat#",
    schema: "http://schema.org/",
    void: "http://rdfs.org/ns/void#",
    prov: "http://www.w3.org/ns/prov#",
    vann: "http://purl.org/vocab/vann/",
    qb: "http://purl.org/linked-data/cube#",
    time: "http://www.w3.org/2006/time#",
    geo: "http://www.w3.org/2003/01/geo/wgs84_pos#",
    as: "https://www.w3.org/ns/activitystreams#",
    vs: "http://www.w3.org/2003/06/sw-vocab-status/ns#",
    dbo: "http://dbpedia.org/ontology/",
    dbr: "http://dbpedia.org/resource/",
    dbp: "http://dbpedia.org/property/",
  });
});

test("queryPrefixes - formats every prefix as a SPARQL prefix declaration", () => {
  for (const [alias, iri] of Object.entries(prefixes)) {
    expect(queryPrefixes).toContain(`prefix ${alias}: <${iri}>`);
  }
});

test("queryPrefixes - joins declarations with newlines", () => {
  expect(queryPrefixes.split("\n")).toHaveLength(Object.keys(prefixes).length);
});
