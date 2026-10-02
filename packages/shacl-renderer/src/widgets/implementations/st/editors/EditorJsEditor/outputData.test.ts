import { expect, test } from "vite-plus/test";
import type { OutputData } from "@editorjs/editorjs";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ed, ex, rdf } from "@/helpers/namespaces.ts";
import { readOutputData, stableStringify, writeOutputData } from "./outputData.ts";

const document: OutputData = {
  time: 1700000000000,
  version: "2.31.6",
  blocks: [
    { id: "h", type: "header", data: { text: "Title", level: 2 } },
    { id: "p", type: "paragraph", data: { text: "Some <b>bold</b> text" } },
    {
      id: "l",
      type: "list",
      data: {
        style: "unordered",
        meta: {},
        items: [
          { content: "One", meta: {}, items: [{ content: "Nested", meta: {}, items: [] }] },
          { content: "Two", meta: {}, items: [] },
        ],
      },
    },
    { id: "c", type: "checklist", data: { items: [{ text: "Done", checked: true }] } },
  ],
};

test("readOutputData - reads back exactly what writeOutputData wrote", () => {
  const store = RdfStore.createDefault();
  const node = factory.blankNode();
  writeOutputData(store, node, document);

  expect(stableStringify(readOutputData(store, node))).toBe(stableStringify(document));
  expect(store.getQuads(node, rdf("type"), ed("OutputData"))).toHaveLength(1);
});

test("writeOutputData - replaces the previous document wholesale, leaving no orphaned triples", () => {
  const store = RdfStore.createDefault();
  const node = factory.blankNode();
  writeOutputData(store, node, document);
  const replacement: OutputData = {
    time: 1,
    version: "2.31.6",
    blocks: [{ id: "p", type: "paragraph", data: { text: "Only this" } }],
  };
  writeOutputData(store, node, replacement);

  const fresh = RdfStore.createDefault();
  writeOutputData(fresh, factory.blankNode(), replacement);

  expect(stableStringify(readOutputData(store, node))).toBe(stableStringify(replacement));
  expect(store.size).toBe(fresh.size);
});

test("writeOutputData - never touches triples about other resources the document links to", () => {
  const store = RdfStore.createDefault();
  const node = factory.blankNode();
  store.addQuad(factory.quad(ex("other"), ex("label"), factory.literal("keep me")));
  writeOutputData(store, node, {
    blocks: [{ type: "paragraph", data: { text: "x" } }],
  });
  store.addQuad(factory.quad(node, ex("unrelated"), ex("other")));
  writeOutputData(store, node, { blocks: [] });

  expect(store.getQuads(ex("other"), ex("label"))).toHaveLength(1);
  expect(store.getQuads(node, ex("unrelated"))).toHaveLength(1);
});

test("readOutputData - reads a document in shacl-renderer's EditorJsEditor layout", async () => {
  const store = await parseRdf(
    `
      @prefix ed: <https://editorjs.io/> .
      @prefix ex: <http://example.org/> .

      ex:post ex:body [
        a ed:OutputData ;
        ed:time 1234 ;
        ed:version "13" ;
        ed:blocks ([
          ed:id "9d61vUfGCT" ;
          ed:type "paragraph" ;
          ed:data [ ed:text "Lorem" ] ;
        ]) ;
      ] .
    `,
    "text/turtle",
  );
  const node = store.getQuads(ex("post"), ex("body"))[0].object as ReturnType<typeof factory.blankNode>;

  expect(readOutputData(store, node)).toEqual({
    time: 1234,
    version: "13",
    blocks: [{ id: "9d61vUfGCT", type: "paragraph", data: { text: "Lorem" } }],
  });
});

test("readOutputData - undefined for a node with no document yet", () => {
  expect(readOutputData(RdfStore.createDefault(), factory.blankNode())).toBeUndefined();
});
