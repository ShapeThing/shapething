import { expect, test } from "vite-plus/test";
import { getRdfList } from "@/helpers/rdfList.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, rdf } from "@/helpers/namespaces.ts";

function parse(turtle: string) {
  return parseRdf(
    `
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix ex: <http://example.com/> .

        ${turtle}
    `,
    "text/turtle",
  );
}

test("getRdfList - reads every item of a well-formed list, in order", async () => {
  const store = await parse(`
        ex:x ex:head ( ex:a ex:b ex:c ) .
    `);
  const [head] = store.getQuads(ex("x"), ex("head"));

  const items = getRdfList(head.object, store);
  expect(items.map((item) => item.value)).toEqual([ex("a").value, ex("b").value, ex("c").value]);
});

test("getRdfList - returns an empty array for an empty list", async () => {
  const store = await parse(`
        ex:x ex:head () .
    `);
  const [head] = store.getQuads(ex("x"), ex("head"));

  expect(getRdfList(head.object, store)).toEqual([]);
});

test("getRdfList - returns an empty array when rdf:nil is passed directly", async () => {
  const store = await parse(``);
  expect(getRdfList(rdf("nil"), store)).toEqual([]);
});

test("getRdfList - returns an empty array for a node that has no rdf:first", async () => {
  const store = await parse(`
        ex:x ex:head _:node1 .
        _:node1 rdf:rest rdf:nil .
    `);
  const [head] = store.getQuads(ex("x"), ex("head"));

  expect(getRdfList(head.object, store)).toEqual([]);
});

test("getRdfList - stops but keeps collected items when a node is missing rdf:rest", async () => {
  const store = await parse(`
        ex:x ex:head _:node1 .
        _:node1 rdf:first ex:a ;
                rdf:rest _:node2 .
        _:node2 rdf:first ex:b .
    `);
  const [head] = store.getQuads(ex("x"), ex("head"));

  const items = getRdfList(head.object, store);
  expect(items.map((item) => item.value)).toEqual([ex("a").value, ex("b").value]);
});

test("getRdfList - returns an empty array for a term that is not a list node (e.g. a literal)", async () => {
  const store = await parse(`
        ex:x ex:head "not a list" .
    `);
  const [head] = store.getQuads(ex("x"), ex("head"));

  expect(getRdfList(head.object, store)).toEqual([]);
});
