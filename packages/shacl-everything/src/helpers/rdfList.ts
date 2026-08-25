import type { Quad_Object, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { rdf } from "@/helpers/namespaces.ts";

export type RdfListCell = { cell: Term; value: Term };

/**
 * Walks rdf:first/rdf:rest from `listNode` to its items, alongside the list-cell blank node each
 * one lives on - the cell (not the value, which two items can share, e.g. duplicate scores) is
 * what's stable and unique enough to key a rendered row on.
 */
export function getRdfListCells(listNode: Term, store: RdfStore): RdfListCell[] {
  const cells: RdfListCell[] = [];
  let current = listNode;

  while (current && (current.termType === "BlankNode" || current.termType === "NamedNode")) {
    if (current.value === rdf("nil").value) {
      break;
    }

    const firstQuad = store.getQuads(current, rdf("first"))[0];
    if (!firstQuad) {
      break;
    }
    cells.push({ cell: current, value: firstQuad.object });

    const restQuad = store.getQuads(current, rdf("rest"))[0];
    if (!restQuad) {
      break;
    }
    current = restQuad.object;
  }

  return cells;
}

export function getRdfList(listNode: Term, store: RdfStore): Term[] {
  return getRdfListCells(listNode, store).map((entry) => entry.value);
}

/**
 * Replaces the whole rdf:List starting at `oldHead` with a fresh one holding `values`, in order -
 * deleting every rdf:first/rdf:rest quad belonging to `oldHead`'s own cells and writing new
 * blank-node cells for `values`, the same delete-and-rebuild strategy the legacy shacl-renderer
 * package's RdfListStorageStrategy already proved out. Only ever touches the list skeleton: the
 * values themselves (including any subgraph hanging off an object-shaped one) are never written
 * or removed, only which cell points to which value and in what order. Returns the new head -
 * rdf:nil when `values` is empty.
 */
export function rebuildRdfList(oldHead: Term, values: Term[], store: RdfStore): Term {
  for (const { cell } of getRdfListCells(oldHead, store)) {
    for (const quad of store.getQuads(cell, rdf("first"))) store.removeQuad(quad);
    for (const quad of store.getQuads(cell, rdf("rest"))) store.removeQuad(quad);
  }

  return values.reduceRight<Quad_Object>((rest, value) => {
    const cell = factory.blankNode();
    store.addQuad(factory.quad(cell, rdf("first"), value as Quad_Object));
    store.addQuad(factory.quad(cell, rdf("rest"), rest));
    return cell;
  }, rdf("nil"));
}
