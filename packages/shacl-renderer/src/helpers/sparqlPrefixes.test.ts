import { describe, expect, it } from "vitest";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { declaredPrefixes, prefixDeclarationLines } from "@/helpers/sparqlPrefixes.ts";

const graph = await parseRdf(
  `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix ex: <http://example.org/> .

  ex:ontology
    sh:declare [ sh:prefix "skos" ; sh:namespace "http://www.w3.org/2004/02/skos/core#"^^xsd:anyURI ] ,
      [ sh:prefix "ex" ; sh:namespace "http://example.org/"^^xsd:anyURI ] ,
      [ sh:prefix "incomplete" ] .

  ex:other sh:declare [ sh:prefix "skos" ; sh:namespace "http://example.org/other-skos#" ] .

  ex:constraint sh:prefixes ex:ontology, ex:other .
  ex:bare sh:select "SELECT $this WHERE {}" .
`,
  "text/turtle",
);

describe("declaredPrefixes", () => {
  it("collects every complete sh:declare of every sh:prefixes value, each prefix once", () => {
    const prefixes = declaredPrefixes(factory.namedNode("http://example.org/constraint"), graph);
    expect(prefixes.map(({ prefix }) => prefix).sort()).toEqual(["ex", "skos"]);
    expect(prefixes).toContainEqual({ prefix: "ex", namespace: "http://example.org/" });
  });

  it("is empty without sh:prefixes", () => {
    expect(declaredPrefixes(factory.namedNode("http://example.org/bare"), graph)).toEqual([]);
  });
});

describe("prefixDeclarationLines", () => {
  const declarations = [
    { prefix: "skos", namespace: "http://www.w3.org/2004/02/skos/core#" },
    { prefix: "ex", namespace: "http://example.org/" },
  ];

  it("gives a PREFIX line for each declaration", () => {
    expect(prefixDeclarationLines("SELECT $this WHERE {}", declarations)).toEqual([
      "PREFIX skos: <http://www.w3.org/2004/02/skos/core#>",
      "PREFIX ex: <http://example.org/>",
    ]);
  });

  it("leaves out a prefix the query declares itself, whatever the keyword's case", () => {
    const query = "prefix skos: <http://www.w3.org/2004/02/skos/core#>\nSELECT $this WHERE {}";
    expect(prefixDeclarationLines(query, declarations)).toEqual([
      "PREFIX ex: <http://example.org/>",
    ]);
  });

  it("is empty without declarations", () => {
    expect(prefixDeclarationLines("ASK {}", [])).toEqual([]);
  });
});
