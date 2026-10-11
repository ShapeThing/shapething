import { expect, test } from "vite-plus/test";
import { Engine as ShaclEngine } from "shacl-engine";
import { factory } from "@/helpers/factory.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes, sh } from "@/helpers/namespaces.ts";
import { shapesGraphWithoutDynamicIn } from "./shapesGraphWithoutDynamicIn.ts";
import {
  federatedPropertyShapes,
  withoutUncheckableRemoteValueResults,
} from "./federatedPropertyShapes.ts";

const parse = (turtle: string) => parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");

// Mirrors the federated AutoCompleteEditor story / academic showcase: a remote value (only
// described on DBpedia) used to always show "Error:" for sh:class and "Value does not have shape"
// for sh:node, since neither can ever pass against the local dataGraph.
const shapesTurtle = `
  ex:PersonShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property ex:federatedProperty, ex:localProperty .

  ex:federatedProperty sh:path ex:favouritePhilosopher ;
    sh:class ex:Philosopher ;
    sh:node ex:PhilosopherShape ;
    sh:in [ sh:select """
      SELECT ?value WHERE { SERVICE <https://example.com/sparql> { ?value a ex:Philosopher } }
    """ ] .

  ex:localProperty sh:path ex:knows ;
    sh:class ex:Philosopher .

  ex:PhilosopherShape sh:property [ sh:path rdfs:label ; sh:minCount 1 ] .
`;

const validate = async (dataTurtle: string) => {
  const shapesGraph = await parse(shapesTurtle);
  const dataGraph = await parse(dataTurtle);
  const engine = new ShaclEngine(shapesGraphWithoutDynamicIn(shapesGraph).asDataset(), { factory });
  const report = await engine.validate(
    { dataset: dataGraph.asDataset(), terms: [ex("alice")] },
    [{ terms: [ex("PersonShape")] }],
  );
  return withoutUncheckableRemoteValueResults(
    report.results,
    federatedPropertyShapes(shapesGraph),
    dataGraph,
  );
};

test("federatedPropertyShapes() finds shapes whose sh:in/shui:searchQuery reach a SERVICE", async () => {
  const shapesGraph = await parse(`
    ${shapesTurtle}
    ex:searchProperty shui:searchQuery "SELECT ?value WHERE { SERVICE <https://example.com/sparql> { ?value ?p ?o } }" .
    ex:localSelectProperty sh:in [ sh:select "SELECT ?value WHERE { ?value a ex:Local }" ] .
  `);

  expect([...federatedPropertyShapes(shapesGraph)].sort()).toEqual(
    [ex("federatedProperty").value, ex("searchProperty").value].sort(),
  );
});

test("withoutUncheckableRemoteValueResults() drops sh:class/sh:node results for a remote value of a federated property", async () => {
  const results = await validate(`
    ex:alice a ex:Person ;
      ex:favouritePhilosopher <http://dbpedia.org/resource/Aristotle> .
  `);

  expect(results).toEqual([]);
});

test("withoutUncheckableRemoteValueResults() keeps those results for local values and non-federated properties", async () => {
  const results = await validate(`
    ex:alice a ex:Person ;
      ex:favouritePhilosopher ex:localPhilosopher ;
      ex:knows <http://dbpedia.org/resource/Plato> .
    ex:localPhilosopher a ex:NotAPhilosopher .
  `);

  const summary = results.map((result) => [
    result.shape.ptr.term.value,
    result.constraintComponent?.value,
  ]);
  expect(summary).toContainEqual([ex("federatedProperty").value, sh("ClassConstraintComponent").value]);
  expect(summary).toContainEqual([ex("federatedProperty").value, sh("NodeConstraintComponent").value]);
  expect(summary).toContainEqual([ex("localProperty").value, sh("ClassConstraintComponent").value]);
});
