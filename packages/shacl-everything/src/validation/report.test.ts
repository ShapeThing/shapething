import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, sh } from "@/helpers/namespaces.ts";
import { factory } from "@/helpers/factory.ts";
import { parsePathNode } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import { parseValidationReport, resolveReport } from "@/validation/report.ts";

const PREFIXES = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix ex: <http://example.org/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
`;

const turtle = (body: string) => parseRdf(PREFIXES + body, "text/turtle");

const pathOf = (shape: unknown, shapesGraph: RdfStore) =>
  toSparql(
    parsePathNode(shapesGraph.getQuads(shape as never, sh("path"))[0].object, shapesGraph),
  );

test("parseValidationReport - reads conforms, every result and its sh:detail", async () => {
  const report = await turtle(`
    [] a sh:ValidationReport ;
      sh:conforms false ;
      sh:result [
        sh:focusNode ex:alice ;
        sh:resultPath ( ex:address ex:city ) ;
        sh:value "Amstrdam" ;
        sh:resultSeverity sh:Warning ;
        sh:sourceConstraintComponent sh:InConstraintComponent ;
        sh:resultMessage "Unknown city"@en, "Onbekende stad"@nl ;
        sh:detail [
          sh:focusNode ex:alice ;
          sh:resultSeverity sh:Info ;
          sh:sourceConstraintComponent sh:NodeConstraintComponent ;
        ] ;
      ] .
  `);
  const parsed = parseValidationReport(report);

  expect(parsed.conforms).toBe(false);
  expect(parsed.results).toHaveLength(1);
  const [result] = parsed.results;
  expect(result.focusNode.equals(ex("alice"))).toBe(true);
  expect(result.path && toSparql(result.path)).toBe("<http://example.org/address> / <http://example.org/city>");
  expect(result.value?.value).toBe("Amstrdam");
  expect(result.severity.equals(sh("Warning"))).toBe(true);
  expect(result.messages.map((message) => message.language).sort()).toEqual(["en", "nl"]);
  expect(result.details).toHaveLength(1);
  expect(result.details[0].severity.equals(sh("Info"))).toBe(true);
});

test("parseValidationReport - a missing sh:resultSeverity defaults to sh:Violation", async () => {
  const report = await turtle(`
    [] a sh:ValidationReport ; sh:conforms false ;
      sh:result [ sh:focusNode ex:alice ; sh:sourceConstraintComponent sh:ClassConstraintComponent ] .
  `);
  expect(parseValidationReport(report).results[0].severity.equals(sh("Violation"))).toBe(true);
});

test("resolveReport - uses sh:sourceShape when the shapes graph has it", async () => {
  const shapesGraph = await turtle(`
    ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person ; sh:property ex:PersonShape-name .
    ex:PersonShape-name sh:path ex:name ; sh:minCount 1 ; sh:name "Name" .
  `);
  const report = await turtle(`
    [] a sh:ValidationReport ; sh:conforms false ;
      sh:result [
        sh:focusNode ex:alice ; sh:resultPath ex:name ; sh:resultSeverity sh:Violation ;
        sh:sourceShape ex:PersonShape-name ; sh:sourceConstraintComponent sh:MinCountConstraintComponent ;
      ] .
  `);
  const resolved = resolveReport(parseValidationReport(report), shapesGraph, RdfStore.createDefault());

  expect(resolved.results).toHaveLength(1);
  expect(resolved.results[0].sourceShape?.equals(ex("PersonShape-name"))).toBe(true);
  expect(resolved.results[0].constraintShape?.equals(ex("PersonShape-name"))).toBe(true);
  // The focus node's generated node shape lists exactly that property shape.
  const [focusNode] = resolved.focusNodes;
  expect(focusNode.focusNode.equals(ex("alice"))).toBe(true);
  expect(
    shapesGraph.getQuads(focusNode.nodeShape, sh("property")).map((quad) => quad.object.value),
  ).toEqual([ex("PersonShape-name").value]);
});

test("resolveReport - a blank-node sh:sourceShape from a separate report falls back to matching sh:path", async () => {
  const shapesGraph = await turtle(`
    ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person ;
      sh:property [ sh:path ex:name ; sh:minCount 1 ; sh:name "Name" ] .
  `);
  const dataGraph = await turtle(`ex:alice a ex:Person .`);
  // Parsed on its own, so its _:shape is a different blank node than the shapes graph's.
  const report = await turtle(`
    [] a sh:ValidationReport ; sh:conforms false ;
      sh:result [
        sh:focusNode ex:alice ; sh:resultPath ex:name ; sh:resultSeverity sh:Violation ;
        sh:sourceShape _:shape ; sh:sourceConstraintComponent sh:MinCountConstraintComponent ;
      ] .
  `);
  const realPropertyShape = shapesGraph.getQuads(ex("PersonShape"), sh("property"))[0].object;
  const resolved = resolveReport(parseValidationReport(report), shapesGraph, dataGraph);

  expect(resolved.results[0].sourceShape?.equals(realPropertyShape)).toBe(true);
  expect(resolved.results[0].constraintShape?.equals(realPropertyShape)).toBe(true);
});

test("resolveReport - without shapes, generates a property shape from sh:resultPath and reconstructs the value", async () => {
  const shapesGraph = RdfStore.createDefault();
  const dataGraph = RdfStore.createDefault();
  const report = await turtle(`
    [] a sh:ValidationReport ; sh:conforms false ;
      sh:result [
        sh:focusNode ex:alice ; sh:resultPath [ sh:inversePath ex:employs ] ; sh:value ex:acme ;
        sh:resultSeverity sh:Violation ; sh:sourceConstraintComponent sh:ClassConstraintComponent ;
      ] ;
      sh:result [
        sh:focusNode ex:bob ; sh:resultPath [ sh:inversePath ex:employs ] ;
        sh:resultSeverity sh:Violation ; sh:sourceConstraintComponent sh:MinCountConstraintComponent ;
      ] .
  `);
  const resolved = resolveReport(parseValidationReport(report), shapesGraph, dataGraph);

  const [alice, bob] = resolved.results;
  // One generated shape per distinct path, shared by both focus nodes.
  expect(alice.sourceShape?.equals(bob.sourceShape)).toBe(true);
  expect(pathOf(alice.sourceShape, shapesGraph)).toBe("^<http://example.org/employs>");
  // A generated shape has no constraint parameters to describe the result with.
  expect(alice.constraintShape).toBeUndefined();
  // The inverse path's value was written back in the right direction.
  expect(dataGraph.getQuads(ex("acme"), ex("employs"), ex("alice")).length).toBe(1);
  expect(resolved.focusNodes).toHaveLength(2);
});

test("resolveReport - sh:closed's undeclared property gets its own generated shape, not an unrelated same-path one", async () => {
  const shapesGraph = await turtle(`
    ex:PersonShape a sh:NodeShape ; sh:closed true ; sh:property [ sh:path ex:name ] .
    ex:CompanyShape a sh:NodeShape ; sh:property ex:CompanyShape-founded .
    ex:CompanyShape-founded sh:path ex:birthDate ; sh:name "Founded" .
  `);
  const report = await turtle(`
    [] a sh:ValidationReport ; sh:conforms false ;
      sh:result [
        sh:focusNode ex:alice ; sh:resultPath ex:birthDate ; sh:value "1999-09-09"^^xsd:date ;
        sh:resultSeverity sh:Violation ; sh:sourceShape ex:PersonShape ;
        sh:sourceConstraintComponent sh:ClosedConstraintComponent ;
      ] .
  `);
  const resolved = resolveReport(parseValidationReport(report), shapesGraph, RdfStore.createDefault());

  const [result] = resolved.results;
  expect(result.sourceShape?.equals(ex("CompanyShape-founded"))).toBe(false);
  expect(pathOf(result.sourceShape, shapesGraph)).toBe("<http://example.org/birthDate>");
  // The node shape holds sh:closed's own parameter.
  expect(result.constraintShape?.equals(ex("PersonShape"))).toBe(true);
});

test("resolveReport - a result without sh:resultPath belongs to the focus node itself", async () => {
  const report = await turtle(`
    [] a sh:ValidationReport ; sh:conforms false ;
      sh:result [
        sh:focusNode ex:alice ; sh:value ex:alice ; sh:resultSeverity sh:Warning ;
        sh:sourceConstraintComponent sh:ClassConstraintComponent ;
      ] ;
      sh:result [
        sh:focusNode ex:bob ; sh:resultPath ex:name ; sh:resultSeverity sh:Violation ;
        sh:sourceConstraintComponent sh:MinCountConstraintComponent ;
      ] .
  `);
  const resolved = resolveReport(
    parseValidationReport(report),
    RdfStore.createDefault(),
    RdfStore.createDefault(),
  );

  expect(resolved.results).toHaveLength(1);
  // Bob's violation sorts before Alice's warning.
  expect(resolved.focusNodes.map((focusNode) => focusNode.focusNode.value)).toEqual([
    ex("bob").value,
    ex("alice").value,
  ]);
  expect(resolved.focusNodes[1].nodeResults).toHaveLength(1);
  expect(resolved.focusNodes[1].nodeResults[0].sourceShape).toBeUndefined();
});

test("resolveReport - the report's values replace the data's current values for that property", async () => {
  // Since validated, Alice's email was fixed and a second one added.
  const dataGraph = await turtle(`
    ex:alice ex:email "alice@example.org", "a.smith@example.org" ; ex:name "Alice" ; ex:nick "Al", "Ali" .
  `);
  const report = await turtle(`
    [] a sh:ValidationReport ; sh:conforms false ;
      sh:result [
        sh:focusNode ex:alice ; sh:resultPath ex:email ; sh:value "alice.example.org" ;
        sh:resultSeverity sh:Violation ; sh:sourceConstraintComponent sh:PatternConstraintComponent ;
      ] ;
      sh:result [
        sh:focusNode ex:alice ; sh:resultPath ex:nick ;
        sh:resultSeverity sh:Violation ; sh:sourceConstraintComponent sh:MaxCountConstraintComponent ;
      ] .
  `);
  resolveReport(parseValidationReport(report), RdfStore.createDefault(), dataGraph);

  expect(dataGraph.getQuads(ex("alice"), ex("email")).map((quad) => quad.object.value)).toEqual([
    "alice.example.org",
  ]);
  // No sh:value to replace them with - the data's own values stay.
  expect(dataGraph.getQuads(ex("alice"), ex("nick"))).toHaveLength(2);
  // Unreported properties are untouched.
  expect(dataGraph.getQuads(ex("alice"), ex("name"), factory.literal("Alice"))).toHaveLength(1);
});
