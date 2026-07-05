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
