import type { Quad_Object, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

/**
 * The write-side counterpart to parsePropertyPath/parsePathNode: materializes a parsed
 * PropertyPath as fresh sh:path triples in `store`, returning the term a `sh:path` triple should
 * point at. Used by structure/filterShape.ts to copy a source property shape's path structure
 * (predicate, sh:alternativePath, sh:sequencePath, sh:inversePath, sh:zeroOrMorePath,
 * sh:oneOrMorePath, sh:zeroOrOnePath - including nested combinations) onto the generated filter
 * shape, rather than re-deriving it from a SPARQL string. Every compound path always mints a fresh
 * blank node/list, even if `path` was originally parsed from a different store, so writing the same
 * path twice never accidentally shares (or collides with) node identity between the two writes.
 */
export function writePropertyPath(path: PropertyPath, store: RdfStore): Term {
  switch (path.type) {
    case "predicate":
      return path.predicate;

    case "sequence": {
      const items = path.items.map((item) => writePropertyPath(item, store));
      return rebuildRdfList(rdf("nil"), items, store);
    }

    case "alternative": {
      const node = factory.blankNode();
      const items = path.items.map((item) => writePropertyPath(item, store));
      const list = rebuildRdfList(rdf("nil"), items, store);
      store.addQuad(factory.quad(node, sh("alternativePath"), list as Quad_Object));
      return node;
    }

    case "inverse": {
      const node = factory.blankNode();
      store.addQuad(
        factory.quad(node, sh("inversePath"), writePropertyPath(path.path, store) as Quad_Object),
      );
      return node;
    }

    case "zeroOrMore": {
      const node = factory.blankNode();
      store.addQuad(
        factory.quad(
          node,
          sh("zeroOrMorePath"),
          writePropertyPath(path.path, store) as Quad_Object,
        ),
      );
      return node;
    }

    case "oneOrMore": {
      const node = factory.blankNode();
      store.addQuad(
        factory.quad(node, sh("oneOrMorePath"), writePropertyPath(path.path, store) as Quad_Object),
      );
      return node;
    }

    case "zeroOrOne": {
      const node = factory.blankNode();
      store.addQuad(
        factory.quad(node, sh("zeroOrOnePath"), writePropertyPath(path.path, store) as Quad_Object),
      );
      return node;
    }
  }
}
