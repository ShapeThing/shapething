import { expect, test } from "vite-plus/test";
import { validate } from "@/scoring/score.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, shui } from "@/helpers/namespaces.ts";
import widgetScoringTtl from "@/scoring/widget-scoring.ttl?raw";

// widget-scoring.ttl is static bundle content - parse it once and reuse across every test rather
// than re-parsing the same turtle per assertion.
const widgetScoringGraph = parseRdf(widgetScoringTtl, "text/turtle");

const TURTLE_PREFIXES = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix ex: <http://example.org/> .
`;

// Builds a lone ex:someShape sh:PropertyShape carrying whatever constraint turtle is passed, then
// checks it against one of widget-scoring.ttl's own shapesGraphShape rules - SHACL 1.2 §7.4 allows
// sh:datatype/sh:nodeKind to hold either a plain IRI or a SHACL list of IRIs (spec issue #1179), so
// every case below is exercised both ways.
async function conforms(shapeName: string, propertyShapeBody: string): Promise<boolean> {
  const shapesGraph = await parseRdf(
    `${TURTLE_PREFIXES}
      ex:someShape a sh:PropertyShape ;
        sh:path ex:someProperty ;
        ${propertyShapeBody} .
    `,
    "text/turtle",
  );

  return validate({
    focusNode: ex("someShape"),
    targetGraph: shapesGraph,
    shapesGraph: await widgetScoringGraph,
    shapeNode: shui(shapeName),
  });
}

test("hasNodeKindIRIConstraint conforms for a direct sh:nodeKind sh:IRI", async () => {
  expect(await conforms("hasNodeKindIRIConstraint", "sh:nodeKind sh:IRI")).toBe(true);
});

test("hasNodeKindIRIConstraint does not conform for a direct sh:nodeKind sh:BlankNode", async () => {
  expect(await conforms("hasNodeKindIRIConstraint", "sh:nodeKind sh:BlankNode")).toBe(false);
});

test("hasNodeKindIRIConstraint conforms when sh:IRI is a member of a SHACL list sh:nodeKind", async () => {
  expect(await conforms("hasNodeKindIRIConstraint", "sh:nodeKind ( sh:IRI sh:BlankNode )")).toBe(
    true,
  );
});

test("hasNodeKindIRIConstraint does not conform when sh:IRI is absent from a SHACL list sh:nodeKind", async () => {
  expect(
    await conforms("hasNodeKindIRIConstraint", "sh:nodeKind ( sh:BlankNode sh:Literal )"),
  ).toBe(false);
});

test("hasNodeKindLiteralConstraint conforms for a direct sh:nodeKind sh:Literal", async () => {
  expect(await conforms("hasNodeKindLiteralConstraint", "sh:nodeKind sh:Literal")).toBe(true);
});

test("hasNodeKindLiteralConstraint conforms when sh:Literal is a member of a SHACL list sh:nodeKind", async () => {
  expect(await conforms("hasNodeKindLiteralConstraint", "sh:nodeKind ( sh:IRI sh:Literal )")).toBe(
    true,
  );
});

test("hasNodeKindLiteralConstraint does not conform when sh:Literal is absent from a SHACL list sh:nodeKind", async () => {
  expect(
    await conforms("hasNodeKindLiteralConstraint", "sh:nodeKind ( sh:IRI sh:BlankNode )"),
  ).toBe(false);
});

test("hasDatatypeStringConstraint conforms for a direct sh:datatype xsd:string", async () => {
  expect(await conforms("hasDatatypeStringConstraint", "sh:datatype xsd:string")).toBe(true);
});

test("hasDatatypeStringConstraint does not conform for a direct sh:datatype xsd:integer", async () => {
  expect(await conforms("hasDatatypeStringConstraint", "sh:datatype xsd:integer")).toBe(false);
});

test("hasDatatypeStringConstraint conforms when xsd:string is a member of a SHACL list sh:datatype", async () => {
  expect(
    await conforms("hasDatatypeStringConstraint", "sh:datatype ( xsd:string rdf:langString )"),
  ).toBe(true);
});

test("hasDatatypeStringConstraint does not conform when xsd:string is absent from a SHACL list sh:datatype", async () => {
  expect(
    await conforms("hasDatatypeStringConstraint", "sh:datatype ( xsd:integer xsd:decimal )"),
  ).toBe(false);
});

test("hasDatatypeLangStringConstraint conforms when rdf:langString is a member of a SHACL list sh:datatype", async () => {
  expect(
    await conforms("hasDatatypeLangStringConstraint", "sh:datatype ( xsd:string rdf:langString )"),
  ).toBe(true);
});

test("hasDatatypeLangStringConstraint does not conform when rdf:langString is absent from a SHACL list sh:datatype", async () => {
  expect(await conforms("hasDatatypeLangStringConstraint", "sh:datatype ( xsd:string )")).toBe(
    false,
  );
});

test("hasDatatypeBooleanConstraint conforms for a direct sh:datatype xsd:boolean", async () => {
  expect(await conforms("hasDatatypeBooleanConstraint", "sh:datatype xsd:boolean")).toBe(true);
});

test("hasDatatypeBooleanConstraint conforms when xsd:boolean is a member of a SHACL list sh:datatype", async () => {
  expect(
    await conforms("hasDatatypeBooleanConstraint", "sh:datatype ( xsd:boolean xsd:string )"),
  ).toBe(true);
});

test("hasDatatypeDateConstraint conforms when xsd:date is a member of a SHACL list sh:datatype", async () => {
  expect(await conforms("hasDatatypeDateConstraint", "sh:datatype ( xsd:date xsd:dateTime )")).toBe(
    true,
  );
});

test("hasDatatypeDateConstraint does not conform when xsd:date is absent from a SHACL list sh:datatype", async () => {
  expect(await conforms("hasDatatypeDateConstraint", "sh:datatype ( xsd:dateTime )")).toBe(false);
});

test("hasDatatypeDateTimeConstraint conforms when xsd:dateTime is a member of a SHACL list sh:datatype", async () => {
  expect(
    await conforms("hasDatatypeDateTimeConstraint", "sh:datatype ( xsd:date xsd:dateTime )"),
  ).toBe(true);
});

test("hasDatatypeHTMLConstraint conforms when rdf:HTML is a member of a SHACL list sh:datatype", async () => {
  expect(await conforms("hasDatatypeHTMLConstraint", "sh:datatype ( rdf:HTML xsd:string )")).toBe(
    true,
  );
});

test("hasDatatypeHTMLConstraint does not conform when rdf:HTML is absent from a SHACL list sh:datatype", async () => {
  expect(await conforms("hasDatatypeHTMLConstraint", "sh:datatype ( xsd:string )")).toBe(false);
});

test("hasDatatypeNumericConstraint conforms for a direct sh:datatype xsd:integer", async () => {
  expect(await conforms("hasDatatypeNumericConstraint", "sh:datatype xsd:integer")).toBe(true);
});

test("hasDatatypeNumericConstraint conforms when a numeric datatype is a member of a SHACL list sh:datatype", async () => {
  expect(
    await conforms("hasDatatypeNumericConstraint", "sh:datatype ( xsd:double xsd:string )"),
  ).toBe(true);
});

test("hasDatatypeNumericConstraint does not conform when no numeric datatype is a member of a SHACL list sh:datatype", async () => {
  expect(
    await conforms("hasDatatypeNumericConstraint", "sh:datatype ( xsd:string rdf:langString )"),
  ).toBe(false);
});

test("hasCustomDatatype conforms for a direct custom sh:datatype", async () => {
  expect(await conforms("hasCustomDatatype", "sh:datatype ex:MyCustomType")).toBe(true);
});

test("hasCustomDatatype does not conform for a direct xsd: sh:datatype", async () => {
  expect(await conforms("hasCustomDatatype", "sh:datatype xsd:string")).toBe(false);
});

test("hasCustomDatatype conforms when a custom datatype is a member of a SHACL list sh:datatype", async () => {
  expect(await conforms("hasCustomDatatype", "sh:datatype ( xsd:string ex:MyCustomType )")).toBe(
    true,
  );
});

test("hasCustomDatatype does not conform when every member of a SHACL list sh:datatype is a well-known xsd:/rdf: type", async () => {
  // Regression guard: the SHACL-list head is itself a blank node, which trivially fails any
  // xsd:/rdf: sh:pattern match - a naive fix must not let that blank node be mistaken for "a
  // custom datatype" when every actual list member is well-known.
  expect(await conforms("hasCustomDatatype", "sh:datatype ( xsd:string rdf:langString )")).toBe(
    false,
  );
});
