import type { NamedNode, Quad_Object, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { Engine as ShaclEngine } from "shacl-engine";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { selectQueryFor } from "@/structure/selectQuery.ts";
import {
  FIRST_PROJECTED_VARIABLE,
  insertValuesClause,
  type ResolvedTerm,
  runQuery,
} from "@/outputs/render/hooks/query.ts";

// Spec §10.2: a renderer MAY re-validate shui:searchQuery's results against the surrounding
// property shape before offering them to the user. Two separate mechanisms cover this, matching
// how the rest of this codebase already separates them:
//
// 1. Local/Core constraints (sh:class, sh:node, sh:datatype, sh:nodeKind, a plain rdf:List-valued
//    sh:in, ...) are checked with real shacl-engine validation - see buildLocalConstraintChecker.
//    Skipped entirely when sh:in is the dynamic sh:select form (see that function's docstring).
// 2. A dynamic sh:in [ sh:select "..." ] can't be evaluated by shacl-engine at all (its sh:in
//    constraint component only reads rdf:List values), so it's checked by re-running that same
//    query - not to pull its whole (possibly enormous, e.g. "every dbo:Philosopher") baseline
//    result set, but with its own projected variable pre-bound to exactly the candidates being
//    checked via an injected VALUES clause - see filterByInSelectMembership. That's the same
//    "hand the endpoint a VALUES-bound batch instead of joining locally" technique
//    buildRoleLookupQuery (query.ts) already uses for role lookups, for the same reason: when the
//    query reaches out over SERVICE, injecting VALUES *inside* that block keeps evaluation to a
//    single HTTP request, however many candidates there are - instead of Comunica's join planner
//    materializing one remote request per candidate (a bind join).

const CARDINALITY_PREDICATES: Set<string> = new Set([sh("minCount").value, sh("maxCount").value]);

/**
 * A per-candidate conformance check for `shape`'s own local constraints (sh:class, sh:node,
 * sh:datatype, sh:nodeKind, a plain-list sh:in, ...), built once and reused across every
 * candidate in a single filterConformingResults call. Wraps the *actual* property shape node(s)
 * in a synthetic sh:NodeShape via sh:property, so shacl-engine's own property-shape/path
 * traversal resolves sh:node's nested shape references etc. against the real shapesGraph, rather
 * than this module re-implementing constraint-component semantics by hand. Each candidate is
 * checked against `shape.dataGraph` (plus the one synthetic `focusNode <path> value` triple) so
 * e.g. sh:class/sh:node can actually see a locally-known candidate's own type/property triples,
 * not just an empty synthetic dataset.
 *
 * Returns undefined - skipping local-constraint validation entirely - when: `shape`'s path isn't a
 * single predicate (out of scope for this pass - every real AutoCompleteEditor shape uses one);
 * `shape` declares no property shapes; or `shape`'s sh:in is the dynamic sh:select form (guarded
 * against here too, though filterConformingResults never actually calls this function in that
 * case - it routes to filterByInSelectMembership instead). That last case follows spec §10.2 ¶5
 * literally for a property shape combining sh:in [ sh:select ] with shui:searchQuery: "the
 * isolated property shape used to check a value node SHOULD contain only the sh:in constraint" -
 * sh:class/sh:node etc. are skipped here specifically because a value resolved dynamically
 * (whether via a local sh:select or one reaching out over SERVICE) generally has no local triples
 * of its own, and checking sh:class/sh:node against an empty local dataGraph would otherwise
 * reject every candidate - the exact spurious-violation risk the spec calls out.
 *
 * Cardinality (sh:minCount/sh:maxCount) is always excluded - checking it against one candidate in
 * isolation is meaningless (a minCount:2 shape would otherwise reject every individual candidate).
 */
function buildLocalConstraintChecker(
  shape: PropertyUIElement,
): ((value: Term) => Promise<boolean>) | undefined {
  if (selectQueryFor(shape) !== undefined) return undefined;

  const [firstPropertyShape] = shape.propertyShapes;
  if (!firstPropertyShape) return undefined;

  const pathTerm = shape.shapesGraph.getQuads(firstPropertyShape, sh("path"))[0]?.object;
  if (!pathTerm || pathTerm.termType !== "NamedNode") return undefined;
  const path: NamedNode = pathTerm;

  const propertyShapeValues = new Set(
    shape.propertyShapes.map((propertyShape) => propertyShape.value),
  );

  const isolatedShapesGraph = RdfStore.createDefault();
  for (const quad of shape.shapesGraph.getQuads()) {
    const isOwnCardinality =
      propertyShapeValues.has(quad.subject.value) &&
      CARDINALITY_PREDICATES.has(quad.predicate.value);
    if (isOwnCardinality) continue;

    isolatedShapesGraph.addQuad(quad);
  }

  const nodeShapeNode = factory.blankNode();
  isolatedShapesGraph.addQuad(factory.quad(nodeShapeNode, rdf("type"), sh("NodeShape")));
  for (const propertyShape of shape.propertyShapes) {
    isolatedShapesGraph.addQuad(factory.quad(nodeShapeNode, sh("property"), propertyShape));
  }

  const shaclEngine = new ShaclEngine(isolatedShapesGraph.asDataset(), {
    factory,
  });

  // Copied once and reused across every candidate (see the addQuad/removeQuad pair below) rather
  // than re-copying shape.dataGraph per candidate - safe because candidates are checked one at a
  // time (see filterConformingResults' sequential loop), never concurrently.
  const dataGraph = RdfStore.createDefault();
  for (const quad of shape.dataGraph.getQuads()) dataGraph.addQuad(quad);

  return async (value: Term) => {
    const focusNode = factory.blankNode();
    const syntheticQuad = factory.quad(focusNode, path, value as Quad_Object);
    dataGraph.addQuad(syntheticQuad);

    try {
      const report = await shaclEngine.validate(
        { dataset: dataGraph.asDataset(), terms: [focusNode] },
        [{ terms: [nodeShapeNode] }],
      );
      return report.conforms;
    } catch (error) {
      console.warn("[shacl-everything] shui:searchQuery result validation failed", error);
      return false;
    } finally {
      dataGraph.removeQuad(syntheticQuad);
    }
  };
}

/**
 * Filters `results` down to the subset `shape`'s dynamic sh:in [ sh:select "..." ] itself accepts,
 * by re-running that query with its own projected variable pre-bound to exactly `results`' terms
 * (see insertValuesClause) rather than pulling its full baseline set and checking membership
 * client-side - the returned rows already *are* the conforming subset. Falls back to returning
 * `results` unfiltered (rather than dropping everything) when the query's projected variable can't
 * be determined from its text - this is a defensive backstop (spec §10.2), not the primary
 * correctness mechanism, so failing open on an unusual query shape is preferable to breaking
 * search entirely.
 */
async function filterByInSelectMembership(
  shape: PropertyUIElement,
  inSelectQuery: string,
  results: ResolvedTerm[],
): Promise<ResolvedTerm[]> {
  const variable = inSelectQuery.match(FIRST_PROJECTED_VARIABLE)?.[1];
  if (!variable) return results;

  // sh:in's baseline set is conventionally IRIs (every example in this codebase constrains to
  // sh:class/sh:node-typed resources), so a VALUES clause can express candidates safely as <iri>
  // terms. A non-NamedNode candidate is dropped rather than risking malformed SPARQL from wrapping
  // a literal in <...> - AutoCompleteEditor discards non-NamedNode results downstream regardless
  // (see useInstanceSearch.tsx's runSearchQuery), so this never changes real behavior.
  const namedNodeResults = results.filter(
    (result): result is ResolvedTerm & { term: NamedNode } => result.term.termType === "NamedNode",
  );
  if (namedNodeResults.length === 0) return [];

  const rewritten = insertValuesClause(
    inSelectQuery,
    variable,
    namedNodeResults.map((result) => result.term),
  );
  const conforming = await runQuery(rewritten, shape);
  const conformingValues = new Set(conforming.map((result) => result.term.value));

  return namedNodeResults.filter((result) => conformingValues.has(result.term.value));
}

/**
 * Filters `results` (e.g. shui:searchQuery's output) down to only the values that still conform
 * to `shape`'s surrounding constraints (spec §10.2) - either its dynamic sh:in [ sh:select ]'s own
 * pattern (see filterByInSelectMembership) when it has one, or its local Core constraints (see
 * buildLocalConstraintChecker) otherwise. A shape author writing shui:searchQuery SHOULD already
 * keep its result set within these bounds; this is a defensive backstop for when they don't, not
 * the primary correctness mechanism.
 */
export async function filterConformingResults(
  shape: PropertyUIElement,
  results: ResolvedTerm[],
): Promise<ResolvedTerm[]> {
  if (results.length === 0) return results;

  const inSelectQuery = selectQueryFor(shape);
  if (inSelectQuery !== undefined) {
    return filterByInSelectMembership(shape, inSelectQuery, results);
  }

  const checkLocalConstraints = buildLocalConstraintChecker(shape);
  if (!checkLocalConstraints) return results;

  const kept: ResolvedTerm[] = [];
  for (const result of results) {
    if (await checkLocalConstraints(result.term)) kept.push(result);
  }
  return kept;
}
