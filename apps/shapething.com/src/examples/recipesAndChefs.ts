import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { DataFactory } from "n3";
import { RdfStore } from "rdf-stores";
import { useEffect, useState } from "react";
import { baseUri, onStoreChange, recipesAndChefs } from "./exampleStore";
import { queryBindings, shapesQuads } from "./fetchDocument";

// Cuisines, categories and units, the shapes need their labels and the editors pick from them.
export const vocabulary = recipesAndChefs.find(
  ({ graph }) => graph.value === new URL("vocabulary", baseUri).toString(),
)!.quads;
export const shapesWithVocabulary = [...shapesQuads, ...vocabulary];

export const turtlePrefixes = {
  schema: "http://schema.org/",
  ex: "http://example.org/",
  unit: "http://qudt.org/vocab/unit/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

// The SHACL tools work on an RdfStore from rdf-stores.
export const toStore = (quads: Quad[]) => {
  const store = RdfStore.createDefault();
  for (const quad of quads) store.addQuad(quad);
  return store;
};

export type Option = { iri: string; name: string };

export const listResources = async (type: string): Promise<Option[]> => {
  const bindings = await queryBindings(`PREFIX schema: <http://schema.org/>
SELECT ?resource ?name WHERE {
  ?resource a <${type}> ;
    schema:name ?name .
  FILTER(LANG(?name) = "en")
}
ORDER BY ?name`);
  return bindings.map((binding) => ({
    iri: binding.get("resource")!.value,
    name: binding.get("name")!.value,
  }));
};

// All chefs, so that the chef of a recipe can be picked and shown with its name.
export const fetchChefs = async (): Promise<Quad[]> => {
  const bindings = await queryBindings(
    `SELECT ?chef ?p ?o WHERE { ?chef a <http://example.org/Chef> ; ?p ?o . }`,
  );
  return bindings.map((binding) =>
    DataFactory.quad(
      binding.get("chef") as NamedNode,
      binding.get("p") as NamedNode,
      binding.get("o") as Quad["object"],
    ),
  );
};

type QuadSource = {
  getQuads(subject: Quad["subject"] | null, predicate: null, object: null, graph: null): Quad[];
};

// The document of a resource: its own triples and those of the blank nodes it uses.
export const conciseBoundedDescription = (
  store: QuadSource,
  subject: Term,
  seen = new Set<string>(),
): Quad[] =>
  store.getQuads(subject as Quad["subject"], null, null, null).flatMap((quad) => {
    const triple = DataFactory.quad(quad.subject, quad.predicate, quad.object);
    if (quad.object.termType !== "BlankNode" || seen.has(quad.object.value)) return [triple];
    seen.add(quad.object.value);
    return [triple, ...conciseBoundedDescription(store, quad.object, seen)];
  });

/**
 * Re-renders when the example store changes, for example after picking a folder or saving a recipe.
 */
export const useStoreVersion = () => {
  const [version, setVersion] = useState(0);
  useEffect(() => onStoreChange(() => setVersion((version) => version + 1)), []);
  return version;
};
