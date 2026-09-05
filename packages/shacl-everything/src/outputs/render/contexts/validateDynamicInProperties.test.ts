import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes, sh } from "@/helpers/namespaces.ts";
import { validateDynamicInProperties } from "./validateDynamicInProperties.ts";

const createGraphs = async (shapesTurtle: string, dataTurtle: string) => ({
  shapesGraph: await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle"),
  dataGraph: await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle"),
});

const DYNAMIC_IN_SHAPE = `
  ex:PersonShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property ex:property1 .

  ex:property1 a sh:PropertyShape ;
    sh:path ex:bornIn ;
    sh:in [
      sh:select """
        PREFIX ex: <http://example.org/>
        SELECT ?value WHERE { ?value a ex:AllowedCountry }
      """ ;
    ] .
`;

test("validateDynamicInProperties() reports nothing when the current value conforms", async () => {
  const { shapesGraph, dataGraph } = await createGraphs(
    DYNAMIC_IN_SHAPE,
    `
      ex:Subject a ex:Person ; ex:bornIn ex:Netherlands .
      ex:Netherlands a ex:AllowedCountry .
    `,
  );

  const results = await validateDynamicInProperties(
    shapesGraph,
    dataGraph,
    [ex("PersonShape")],
    ex("Subject"),
  );

  expect(results).toEqual([]);
});

test("validateDynamicInProperties() reports a violation when the current value doesn't conform", async () => {
  const { shapesGraph, dataGraph } = await createGraphs(
    DYNAMIC_IN_SHAPE,
    `
      ex:Subject a ex:Person ; ex:bornIn ex:Atlantis .
      ex:Atlantis a ex:Country .
    `,
  );

  const results = await validateDynamicInProperties(
    shapesGraph,
    dataGraph,
    [ex("PersonShape")],
    ex("Subject"),
  );

  expect(results).toHaveLength(1);
  expect(results[0]?.focusNode.equals(ex("Subject"))).toBe(true);
  expect(results[0]?.sourceShape?.equals(ex("property1"))).toBe(true);
  expect(results[0]?.value?.equals(ex("Atlantis"))).toBe(true);
  expect(results[0]?.severity.equals(sh("Violation"))).toBe(true);
});

test("validateDynamicInProperties() respects an explicit sh:severity", async () => {
  const { shapesGraph, dataGraph } = await createGraphs(
    `
      ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property ex:property1 .

      ex:property1 a sh:PropertyShape ;
        sh:path ex:bornIn ;
        sh:severity sh:Warning ;
        sh:in [
          sh:select """
            PREFIX ex: <http://example.org/>
            SELECT ?value WHERE { ?value a ex:AllowedCountry }
          """ ;
        ] .
    `,
    `ex:Subject a ex:Person ; ex:bornIn ex:Atlantis . ex:Atlantis a ex:Country .`,
  );

  const results = await validateDynamicInProperties(
    shapesGraph,
    dataGraph,
    [ex("PersonShape")],
    ex("Subject"),
  );

  expect(results[0]?.severity.equals(sh("Warning"))).toBe(true);
});

test("validateDynamicInProperties() reports nothing for an unset property", async () => {
  const { shapesGraph, dataGraph } = await createGraphs(
    DYNAMIC_IN_SHAPE,
    `ex:Subject a ex:Person .`,
  );

  const results = await validateDynamicInProperties(
    shapesGraph,
    dataGraph,
    [ex("PersonShape")],
    ex("Subject"),
  );

  expect(results).toEqual([]);
});

test("validateDynamicInProperties() ignores a plain rdf:List sh:in - not its job to check", async () => {
  const { shapesGraph, dataGraph } = await createGraphs(
    `
      ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property ex:property1 .

      ex:property1 a sh:PropertyShape ;
        sh:path ex:status ;
        sh:in ( ex:Active ex:Inactive ) .
    `,
    `ex:Subject a ex:Person ; ex:status ex:Retired .`,
  );

  const results = await validateDynamicInProperties(
    shapesGraph,
    dataGraph,
    [ex("PersonShape")],
    ex("Subject"),
  );

  expect(results).toEqual([]);
});
