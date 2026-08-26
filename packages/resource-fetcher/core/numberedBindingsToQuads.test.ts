import { expect, test } from "vitest";
import { numberedBindingsToQuads } from "./numberedBindingsToQuads.ts";
import { Bindings } from "@comunica/utils-bindings-factory";
import dataFactory from "@rdfjs/data-model";
import { BindingsFactory } from "@comunica/utils-bindings-factory";
import { rf } from "../helpers/namespaces.ts";
import { write } from "@jeswr/pretty-turtle";

const BF = new BindingsFactory(dataFactory);

test("it parses simple bindings", () => {
  const bindings: Bindings = BF.fromRecord({
    node_0: rf("subject"),
    predicate_1: rf("predicate"),
    node_1: rf("node"),
  });
  const quads = numberedBindingsToQuads([bindings]);
  expect([...quads].length).toEqual(1);
  expect([...quads][0].subject.value).toEqual(rf("subject").value);
  expect([...quads][0].predicate.value).toEqual(rf("predicate").value);
  expect([...quads][0].object.value).toEqual(rf("node").value);
});

test("it parses a list", async () => {
  const bindings1: Bindings = BF.fromRecord({
    node_0: rf("subject"),
    predicate_0: rf("predicate"),
    node_list_1: rf("node1"),
  });
  const bindings2: Bindings = BF.fromRecord({
    node_0: rf("subject"),
    predicate_0: rf("predicate"),
    node_list_1: rf("node2"),
  });
  const bindings3: Bindings = BF.fromRecord({
    node_0: rf("subject"),
    predicate_0: rf("predicate"),
    node_list_1: rf("node3"),
  });
  const quads = numberedBindingsToQuads([bindings1, bindings2, bindings3]);
  const output = await write([...quads], {
    prefixes: {
      rf: "https://resource-fetcher.shapething.com/#",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    },
  });
  expect(output).toEqual(`@prefix rf: <https://resource-fetcher.shapething.com/#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

rf:subject rdf:first rf:node1 ;
  rdf:rest (rf:node2 rf:node3) .
`);
});

test("it preserves binding order for a list of numeric literals", async () => {
  // A plain object keyed by item value would re-sort integer-like keys ("88", "42", "100")
  // into ascending numeric order per the ECMAScript spec, discarding the real list order -
  // this reproduces that scenario with a shuffled (non-ascending) binding order.
  const values = [88, 42, 100];
  const bindings = values.map((value) =>
    BF.fromRecord({
      node_0: rf("subject"),
      predicate_0: rf("predicate"),
      node_list_1: dataFactory.literal(
        String(value),
        dataFactory.namedNode("http://www.w3.org/2001/XMLSchema#integer"),
      ),
    }),
  );
  const quads = numberedBindingsToQuads(bindings);
  const output = await write([...quads], {
    prefixes: {
      rf: "https://resource-fetcher.shapething.com/#",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
    },
  });
  expect(output).toEqual(`@prefix rf: <https://resource-fetcher.shapething.com/#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

rf:subject rdf:first 88 ;
  rdf:rest (42 100) .
`);
});
