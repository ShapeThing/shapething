import type { Bindings, NamedNode } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { fetchWithCorsProxyFallback, getQueryEngine } from "@/helpers/queryEngine.ts";
import { effectiveLabelPredicates } from "@/resolution/label.ts";

// Comunica (rather than a hand-rolled fetch) is what actually dereferences each predicate's IRI:
// given as a bare URL `source`, it performs real HTTP content negotiation (an Accept header covering
// every RDF serialization it has a parser for) and picks the matching parser from the response's
// own Content-Type - unlike guessing a format from the URL's file extension, which an ontology term
// IRI (e.g. https://xmlns.com/foaf/0.1/name) typically doesn't have. Shares helpers/queryEngine.ts's
// one engine with every other query in this package.

// The predicate(s) that count as "this property shape already has a name" - sh:name by default, or
// whatever shui:labelPreference (3.4) configures instead. Only a plain-predicate path can be shape
// metadata (propertyLabel's own step 1 constraint - see resolution/label.ts), so a configured
// complex path is skipped here the same way it is there.
function namePredicates(shapesGraph: RdfStore): NamedNode[] {
  const predicates: NamedNode[] = [];
  for (const path of effectiveLabelPredicates(shapesGraph, "propertyShape")) {
    if (path.type !== "predicate") continue;
    predicates.push(path.predicate);
  }
  return predicates;
}

// The predicate(s) propertyLabel() itself would look for on a term's own IRI (rdfs:label by
// default, or shui:labelPreference) - i.e. exactly what's worth fetching from the ontology, since
// merging anything else here wouldn't change what a property ends up labeled with. Only a
// plain-predicate path can be bound by a VALUES clause below, so a configured complex path is
// skipped (consistent with namePredicates above).
function termLabelPredicates(shapesGraph: RdfStore): NamedNode[] {
  const predicates: NamedNode[] = [];
  for (const path of effectiveLabelPredicates(shapesGraph, "term")) {
    if (path.type !== "predicate") continue;
    predicates.push(path.predicate);
  }
  return predicates;
}

// Every distinct sh:path predicate IRI used by a property shape that has none of namePredicates()
// in any language - a plain predicate path only, since a compound (sequence/alternative/inverse/
// zeroOrMore/...) path has no single IRI of its own to dereference.
function predicatesMissingAName(shapesGraph: RdfStore): NamedNode[] {
  const namePreds = namePredicates(shapesGraph);
  const predicates: NamedNode[] = [];
  const seen = new Set<string>();

  for (const { subject, object: path } of shapesGraph.getQuads(null, sh("path"))) {
    if (path.termType !== "NamedNode") continue;
    if (seen.has(path.value)) continue;
    const hasName = namePreds.some(
      (predicate) => shapesGraph.getQuads(subject, predicate).length > 0,
    );
    if (hasName) continue;
    seen.add(path.value);
    predicates.push(path);
  }
  return predicates;
}

// One Comunica query per predicate, rather than one query spanning every predicate's own IRI as a
// `source` together: a bad/unreachable ontology must only cost that one predicate (see the
// Promise.allSettled loop below), and predicates sharing one document (e.g. two IRIs differing
// only by fragment) still only cost Comunica whatever caching it already does across sources
// within a single engine instance.
async function fetchPropertyLabelBindings(
  predicate: NamedNode,
  labelPredicates: NamedNode[],
  corsProxyUrl: string | undefined,
): Promise<Bindings[]> {
  const engine = await getQueryEngine();
  const valuesClause = `values ?labelPredicate { ${labelPredicates
    .map((labelPredicate) => `<${labelPredicate.value}>`)
    .join(" ")} }`;

  const bindingsStream = await engine.queryBindings(
    `select ?labelPredicate ?label where { ${valuesClause} <${predicate.value}> ?labelPredicate ?label . }`,
    {
      sources: [predicate.value],
      ...(corsProxyUrl ? { fetch: fetchWithCorsProxyFallback(corsProxyUrl) } : {}),
    },
  );
  return bindingsStream.toArray();
}

/**
 * Opt-in (Environment.enableMissingPropertyNameDereferencing, off by default): for every property
 * shape (sh:path) in shapesGraph whose path is a plain predicate IRI and that has no sh:name (or
 * whatever shui:labelPreference configures instead) in any language, dereferences that predicate's
 * own IRI via Comunica (real HTTP content negotiation, not a file-extension guess) and merges
 * whichever of the fetched ontology's own triples describe that predicate via the *term* label
 * predicate(s) (rdfs:label by default) into shapesGraph.
 *
 * Deliberately does not synthesize sh:name itself: propertyLabel() (resolution/label.ts) already
 * falls back to exactly these triples once they exist in shapesGraph (its step 3, "SHAPES graph,
 * subject P, configured label path(s)") - merging them here is enough to make property labels
 * resolve, with no separate wiring needed downstream.
 *
 * A predicate that fails to dereference (404, network error, or an ontology with no label triples
 * for itself) is skipped silently and logged - the same posture as owl:imports
 * (resolveRdfSources.ts): one bad/unreachable ontology term must not fail the whole environment.
 *
 * Copies shapesGraph into a fresh RdfStore rather than mutating the caller-supplied one in place -
 * same non-mutating reasoning as addMissingShapes/mergeFacetTextSearchProperties (shapes.ts).
 *
 * Runs after resolveRdfSources (needs a materialized shapesGraph to scan) and after
 * addMissingShapes, so a bare property shape minted there (which never has an sh:name to begin
 * with) is covered by this pass too.
 */
export const dereferenceMissingPropertyNames: Preprocessor = async (environment) => {
  if (!environment.enableMissingPropertyNameDereferencing) return environment;

  const shapesGraph = environment.shapesGraph as RdfStore;
  const predicates = predicatesMissingAName(shapesGraph);
  if (predicates.length === 0) return environment;

  const labelPredicates = termLabelPredicates(shapesGraph);
  if (labelPredicates.length === 0) return environment;

  const results = await Promise.allSettled(
    predicates.map((predicate) =>
      fetchPropertyLabelBindings(predicate, labelPredicates, environment.corsProxyUrl),
    ),
  );

  const merged = RdfStore.createDefault();
  for (const quad of shapesGraph.getQuads()) merged.addQuad(quad);

  for (const [index, result] of results.entries()) {
    const predicate = predicates[index];
    if (result.status === "rejected") {
      console.warn(
        `[shacl-everything] Failed to dereference <${predicate.value}> for its ontology label:`,
        result.reason,
      );
      continue;
    }

    for (const binding of result.value) {
      const labelPredicate = binding.get("labelPredicate");
      const label = binding.get("label");
      if (labelPredicate?.termType !== "NamedNode") continue;
      if (label?.termType !== "Literal") continue;
      merged.addQuad(factory.quad(predicate, labelPredicate, label));
    }
  }

  return { ...environment, shapesGraph: merged };
};
