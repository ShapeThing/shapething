import type { OutputData } from "@editorjs/editorjs";
import type { Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { ed, rdf, xsd } from "@/helpers/namespaces.ts";
import { getRdfList } from "@/helpers/rdfList.ts";
import { termToJsValue } from "@/helpers/termToJsValue.ts";

// shacl-renderer's own EditorJsEditor round-tripped OutputData through a bundled SHACL shape
// (dataToRdf/rdfToData, JSON-LD @vocab ed:). That shape was sh:closed and only ever declared
// ed:text inside a block's ed:data, so any tool whose data has other keys (a header's `level`, a
// list's `style`/`items`) didn't fit it. This keeps that exact RDF layout - ed:OutputData node,
// ed:time/ed:version, ed:blocks as an rdf:List, one ed:<key> predicate per JSON key - but maps it
// generically: an object is a blank node, an array an rdf:List, a scalar a typed literal. So data
// written by shacl-renderer reads back here unchanged, and every Editor.js tool's block data fits.

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const keyToPredicate = (key: string) => ed(encodeURIComponent(key));

function jsonToTerm(value: Json, store: RdfStore): Quad_Object {
  if (Array.isArray(value)) {
    return value.reduceRight<Quad_Object>((rest, item) => {
      const cell = factory.blankNode();
      store.addQuad(factory.quad(cell, rdf("first"), jsonToTerm(item, store)));
      store.addQuad(factory.quad(cell, rdf("rest"), rest));
      return cell;
    }, rdf("nil"));
  }

  if (value !== null && typeof value === "object") {
    const node = factory.blankNode();
    writeObject(node, value, store);
    return node;
  }

  if (typeof value === "boolean") return factory.literal(String(value), xsd("boolean"));
  if (typeof value === "number") {
    return factory.literal(String(value), Number.isInteger(value) ? xsd("integer") : xsd("double"));
  }
  // null has no RDF counterpart - Editor.js tools don't emit it in practice, and writeObject
  // skips the key entirely for it, so this is only reached for plain strings.
  return factory.literal(String(value));
}

function writeObject(node: Quad_Subject, value: { [key: string]: Json }, store: RdfStore): void {
  for (const [key, child] of Object.entries(value)) {
    if (child === null || child === undefined) continue;
    store.addQuad(factory.quad(node, keyToPredicate(key), jsonToTerm(child, store)));
  }
}

function termToJson(term: Term, store: RdfStore, visited: Set<string>): Json {
  if (term.termType === "Literal") return termToJsValue(term) as Json;
  if (term.equals(rdf("nil"))) return [];
  // A reference to some other named resource is never expanded (it isn't part of this document's
  // own subgraph, and could cycle back) - it reads back as its IRI.
  if (term.termType !== "BlankNode") return term.value;
  if (visited.has(term.value)) return null;
  visited.add(term.value);

  if (store.getQuads(term, rdf("first")).length > 0) {
    return getRdfList(term, store).map((item) => termToJson(item, store, visited));
  }

  return readObject(term, store, visited);
}

function readObject(node: Quad_Subject, store: RdfStore, visited: Set<string>) {
  const result: { [key: string]: Json } = {};
  const namespace = ed("").value;
  for (const quad of store.getQuads(node)) {
    if (!quad.predicate.value.startsWith(namespace)) continue;
    const key = decodeURIComponent(quad.predicate.value.slice(namespace.length));
    result[key] = termToJson(quad.object, store, visited);
  }
  return result;
}

/**
 * Reads the Editor.js document stored on `node`, or undefined when `node` has none yet (a
 * freshly-created, still-empty value) - Editor.js then starts from its own empty state.
 */
export function readOutputData(store: RdfStore, node: Quad_Subject): OutputData | undefined {
  if (store.getQuads(node, ed("blocks")).length === 0) return undefined;
  const result = readObject(node, store, new Set([node.value])) as unknown as OutputData;
  return { ...result, blocks: result.blocks ?? [] };
}

// Every blank node reachable from `node` through ed:*/rdf:first/rdf:rest - the document's own
// subgraph, which is exactly what a rewrite has to replace. Named nodes are never descended into
// (see termToJson), so a rewrite can never delete triples about some other resource.
function removeSubgraph(node: Quad_Subject, store: RdfStore, visited: Set<string>): void {
  const namespace = ed("").value;
  for (const quad of store.getQuads(node)) {
    const isDocumentPredicate =
      quad.predicate.value.startsWith(namespace) ||
      quad.predicate.equals(rdf("first")) ||
      quad.predicate.equals(rdf("rest"));
    if (!isDocumentPredicate) continue;
    store.removeQuad(quad);
    if (quad.object.termType === "BlankNode" && !visited.has(quad.object.value)) {
      visited.add(quad.object.value);
      removeSubgraph(quad.object, store, visited);
    }
  }
}

/**
 * Replaces whatever Editor.js document `node` held with `data`, wholesale - Editor.js only ever
 * hands back a complete document from save(), never a diff. Also (re)asserts `node` a
 * ed:OutputData, the signal score.ttl auto-selects this editor on. Callers wrap this in
 * transact() so the rewrite is one undo step.
 */
export function writeOutputData(store: RdfStore, node: Quad_Subject, data: OutputData): void {
  removeSubgraph(node, store, new Set([node.value]));
  if (store.getQuads(node, rdf("type"), ed("OutputData")).length === 0) {
    store.addQuad(factory.quad(node, rdf("type"), ed("OutputData")));
  }
  writeObject(node, data as unknown as { [key: string]: Json }, store);
}

/** JSON.stringify with object keys sorted, so two documents compare equal regardless of the
 * order the store happens to return their predicates in. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, child) =>
    child && typeof child === "object" && !Array.isArray(child)
      ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a.localeCompare(b)))
      : child,
  );
}
