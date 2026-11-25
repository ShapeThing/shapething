import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf, rdfs, sh, shui } from "@/helpers/namespaces.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { createReactiveCache } from "@/helpers/reactiveCache.ts";
import { validate, type ValidateProps } from "@/validation/validate.ts";
import { termKey } from "@/helpers/termKey.ts";
import { XsdValidation } from "rdf-validation";

/**
 * The one ranking order both select() and score() use: descending shui:score, ties broken by the
 * widget's own IRI (ascending) - never by quad/glob order, which depends on which widget folders
 * happen to exist and how the scoring graph was concatenated, so two equally-scored widgets would
 * otherwise swap winners for reasons unrelated to the shapes being rendered.
 */
export function compareScored(
  a: { score: number; widget: Term },
  b: { score: number; widget: Term },
): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.widget.value === b.widget.value) return 0;
  return a.widget.value < b.widget.value ? -1 : 1;
}

type OrderedWidgetScores = Array<{ widgetScore: Term; widget: Term; score: number }>;

// The ranking only depends on the scoring graph, which is a static store shared by every renderer
// (see registry.ts's getScoringGraph) - yet select()/score() ask for it once per property and
// value. Cached per store identity and predicate; the store's size is kept alongside as a cheap
// guard for a caller-supplied scoresGraph that is mutated after the fact.
const orderedWidgetScoresCache = new WeakMap<
  RdfStore,
  Map<string, { size: number; scores: OrderedWidgetScores }>
>();

/**
 * All shui:WidgetScore rules for the given mode (widgetPredicate), ordered by compareScored.
 * Throws on a rule without a numeric shui:score.
 */
export function orderedWidgetScores(
  scoringGraph: RdfStore,
  widgetPredicate: Term,
): OrderedWidgetScores {
  let byPredicate = orderedWidgetScoresCache.get(scoringGraph);
  if (!byPredicate) {
    byPredicate = new Map();
    orderedWidgetScoresCache.set(scoringGraph, byPredicate);
  }
  const cached = byPredicate.get(widgetPredicate.value);
  if (cached && cached.size === scoringGraph.size) return cached.scores;

  const scores = computeOrderedWidgetScores(scoringGraph, widgetPredicate);
  byPredicate.set(widgetPredicate.value, { size: scoringGraph.size, scores });
  return scores;
}

function computeOrderedWidgetScores(
  scoringGraph: RdfStore,
  widgetPredicate: Term,
): OrderedWidgetScores {
  return scoringGraph
    .getQuads(null, widgetPredicate)
    .filter((quad) => hasType(scoringGraph, quad.subject, shui("WidgetScore")))
    .map((quad) => {
      const widgetScore = quad.subject;
      const [scoreQuad] = scoringGraph.getQuads(widgetScore, shui("score"));
      const score = scoreQuad ? parseFloat(scoreQuad.object.value) : NaN;

      if (isNaN(score)) {
        throw new Error(`Invalid Widget Score definition for ${widgetScore.value}`);
      }

      return { widgetScore, widget: quad.object, score };
    })
    .sort(compareScored);
}

export { createReactiveCache, type ReactiveCache } from "@/helpers/reactiveCache.ts";

/**
 * Backs score.ts's cachedValidate() - keyed per whichever RdfStore is being validated against
 * (dataGraph or shapesGraph), so entries for the two never collide even though they share one
 * cache. A dataGraph's entries clear themselves on every write (see createReactiveCache above);
 * shapesGraph is read-only for an Environment's whole lifetime (never wrapped in makeReactive), so
 * getReactivity(shapesGraph) is always undefined and its entries simply memoize forever.
 */
export const shapeValidationCache = createReactiveCache<Promise<boolean>>();

// Constraint parameters that only ever look at the value node itself - never at a triple in the
// data graph (unlike e.g. sh:class, which reads the value's rdf:type, or anything path-based).
const VALUE_ONLY_PREDICATES: Set<string> = new Set(
  [
    "nodeKind",
    "datatype",
    "pattern",
    "flags",
    "minLength",
    "maxLength",
    "languageIn",
    "in",
    "hasValue",
    "minInclusive",
    "maxInclusive",
    "minExclusive",
    "maxExclusive",
    "name",
    "description",
    "message",
    "severity",
    "deactivated",
    "order",
    "group",
  ].map((name) => sh(name).value),
);
const LOGICAL_LIST_PREDICATES: Set<string> = new Set(
  ["or", "and", "xone"].map((name) => sh(name).value),
);
const IGNORED_PREDICATES: Set<string> = new Set([
  rdf("type").value,
  rdfs("label").value,
  rdfs("comment").value,
]);

// Of those, the ones that only look at a value's term type (and, for a literal, its datatype) -
// not at its lexical form, as sh:pattern or sh:in do.
const KIND_ONLY_PREDICATES: Set<string> = new Set(
  [
    "nodeKind",
    "datatype",
    "name",
    "description",
    "message",
    "severity",
    "deactivated",
    "order",
    "group",
  ].map((name) => sh(name).value),
);

const xsdValidation = new XsdValidation();

const shapeClassCache = new WeakMap<RdfStore, Map<string, boolean>>();

/**
 * Whether every constraint `shapeNode` declares - through sh:or/sh:and/sh:xone/sh:not too - uses
 * only `allowed` parameters. With VALUE_ONLY_PREDICATES: whether conformance depends on nothing but
 * the value node itself - true for all of the bundled scoring rules' data graph shapes
 * (shui:isString, shui:isIRI, shui:hasImageFileExtension, ...). Anything else (sh:class,
 * sh:property, a SPARQL constraint, an unknown parameter) counts as reading the data graph.
 */
function usesOnly(
  allowed: Set<string>,
  shapeNode: Term,
  shapesGraph: RdfStore,
  visiting = new Set<string>(),
): boolean {
  const key = `${allowed === KIND_ONLY_PREDICATES ? "kind" : "value"} ${termKey(shapeNode)}`;
  let cache = shapeClassCache.get(shapesGraph);
  if (!cache) shapeClassCache.set(shapesGraph, (cache = new Map()));
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (visiting.has(key)) return false;
  visiting.add(key);

  const result = shapesGraph.getQuads(shapeNode as Quad_Subject).every(({ predicate, object }) => {
    if (IGNORED_PREDICATES.has(predicate.value) || allowed.has(predicate.value)) return true;
    if (predicate.equals(sh("not"))) return usesOnly(allowed, object, shapesGraph, visiting);
    if (LOGICAL_LIST_PREDICATES.has(predicate.value)) {
      return expandListOrTerm(object, shapesGraph).every((member) =>
        usesOnly(allowed, member, shapesGraph, visiting),
      );
    }
    return false;
  });
  cache.set(key, result);
  return result;
}

// Validation results for value-only shapes (see isValueOnlyShape), shared by every data graph: the
// same value gets the same answer whichever resource it appears on, so the next resource rendered
// with the same widgets doesn't re-validate e.g. every string value against shui:isString. Scoped
// to the scoring graph (a shared, read-only store - see registry.ts's getScoringGraph) and capped,
// since the values a long-lived page sees are unbounded.
const valueOnlyResults = new WeakMap<RdfStore, Map<string, Promise<boolean>>>();
const VALUE_ONLY_RESULTS_KEPT = 5000;

/** validate() (validation/validate.ts), memoized per (targetGraph, focusNode, shapeNode) - see helpers.ts's shapeValidationCache. */
export async function cachedValidate(props: ValidateProps): Promise<boolean> {
  const { focusNode, targetGraph, shapeNode, shapesGraph } = props;
  if (!focusNode) return validate(props);

  if (usesOnly(VALUE_ONLY_PREDICATES, shapeNode, shapesGraph)) {
    let results = valueOnlyResults.get(shapesGraph);
    if (!results) valueOnlyResults.set(shapesGraph, (results = new Map()));
    // A shape checking only a value's kind/datatype (shui:isIRI, shui:isDate, ...) gives the same
    // answer for every IRI, every blank node, and every literal of one datatype whose lexical form
    // is as well-formed (or not) - shacl-engine's sh:datatype is exactly "has the datatype and
    // XsdValidation.validateSimple accepts it". So a new resource's values mostly reuse earlier
    // answers. Lexical-form shapes (sh:pattern, sh:in, ...) stay keyed by the value itself.
    const valueKey = !usesOnly(KIND_ONLY_PREDICATES, shapeNode, shapesGraph)
      ? termKey(focusNode)
      : focusNode.termType === "Literal"
        ? `Literal|${focusNode.datatype.value}|${xsdValidation.validateSimple(focusNode) ? 1 : 0}`
        : focusNode.termType;
    const key = `${valueKey}-${termKey(shapeNode)}`;
    let result = results.get(key);
    if (!result) {
      if (results.size >= VALUE_ONLY_RESULTS_KEPT) results.clear();
      result = validate(props);
      results.set(key, result);
    }
    return result;
  }

  return shapeValidationCache.getOrCompute(
    targetGraph,
    `${termKey(focusNode)}-${termKey(shapeNode)}`,
    () => validate(props),
  );
}

export const hasType = (graph: RdfStore, subject: Term, type: Term): boolean =>
  graph.getQuads(subject, rdf("type"), type).length > 0;

export const objects = (graph: RdfStore, subject: Term, predicate: Term): Term[] =>
  graph.getQuads(subject, predicate).map((quad) => quad.object);

/** Whether focusNode conforms to every one of shapeNodes, stopping at the first failure. */
export async function allValid(
  props: Omit<ValidateProps, "shapeNode">,
  shapeNodes: Term[],
): Promise<boolean> {
  for (const shapeNode of shapeNodes) {
    if (!(await cachedValidate({ ...props, shapeNode }))) return false;
  }
  return true;
}
