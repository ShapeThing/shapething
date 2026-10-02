import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { getDefaultNamespace } from "@/resolution/globalConfiguration.ts";

/**
 * A fresh IRI for a user-added node: a random UUID inside shui:defaultNamespace (3.4) when the
 * shapes graph configures one, a urn:uuid otherwise. Never the empty string: rdf-stores' own
 * dictionary encodes a zero-length NamedNode value indistinguishably from the DefaultGraph term, so
 * a quad built from it would silently come back out of the store as DefaultGraph.
 */
export function freshIri(shapesGraph: RdfStore): NamedNode {
  const namespace = getDefaultNamespace(shapesGraph);
  const id = crypto.randomUUID();
  return factory.namedNode(namespace ? `${namespace}${id}` : `urn:uuid:${id}`);
}
