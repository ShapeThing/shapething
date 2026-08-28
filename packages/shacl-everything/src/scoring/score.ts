import type { NamedNode, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { Engine as ShaclEngine } from "shacl-engine";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh, shui, xsd } from "@/helpers/namespaces.ts";

type SelectProps = {
  // A boolean flag; if true, return only the first matching result.
  best: boolean;
  // The node to validate in the instance data. Omit to score based on the shape alone.
  focusNode?: Term;
  // The RDF graph containing the focus node. This is the instance data.
  dataGraph: RdfStore;
  // A shape IRI.
  shapeNode: Term;
  // The RDF graph containing the list of SHACL shapes.
  shapesGraph: RdfStore;
  // The RDF graph containing the Widget Score definitions.
  scoringGraph: RdfStore;

  widgetPredicate: Term;
};

export type WidgetScoreResult = {
  widget: Term;
  widgetScore: Term;
  score: number;
};

type PrepareScoringGraphProps = {
  // The RDF graph containing the list of SHACL shapes - read for shui:editor/shui:viewer
  // declarations.
  shapesGraph: RdfStore;
  // The RDF graph containing the Widget Score definitions, to be extended.
  scoringGraph: RdfStore;
};

const DEFAULT_DECLARED_WIDGET_SCORE = 40;

/**
 * Scoring Graph Preparation (spec §4.3). MUST be called on a scoring graph before it is passed
 * to score()/select() - without it, a widget attached to a shape only via shui:editor/shui:viewer,
 * with no shui:WidgetScore of its own (e.g. a third-party widget shipped without a score.ttl), is
 * never returned. A widget scoringGraph already scores is left untouched even if that scoring
 * doesn't itself cover the declared case - see the shui:editor score.ttl-authoring convention
 * instead (a dedicated band-40 rule whose shapesGraphShape alone tests for the declaration).
 *
 * Depends only on shapesGraph and scoringGraph, not on any particular focus/shape node - callers
 * should run this once per environment (see preprocess/scoringGraphPreparation.ts) and reuse the
 * result, rather than re-running it on every score()/select() call.
 */
export function prepareScoringGraph({
  shapesGraph,
  scoringGraph,
}: PrepareScoringGraphProps): RdfStore {
  const prepared = RdfStore.createDefault();
  for (const quad of scoringGraph.getQuads()) prepared.addQuad(quad);

  // The global shui:defaultWidgetScore configuration property isn't pinned down yet (spec editor's
  // note - pending PR #900), so this reads it generically as a triple with that predicate anywhere
  // in the scoring graph, falling back to the spec's stated default of 40 otherwise.
  const defaultScore =
    scoringGraph.getQuads(null, shui("defaultWidgetScore"))[0]?.object ??
    factory.literal(String(DEFAULT_DECLARED_WIDGET_SCORE), xsd("integer"));

  const alreadyScoredWidgets = new Set(
    scoringGraph
      .getQuads(null, rdf("type"), shui("WidgetScore"))
      .map((quad) => scoringGraph.getQuads(quad.subject, shui("widget"))[0]?.object.value),
  );

  for (const widgetPredicate of [shui("editor"), shui("viewer")]) {
    const declaredWidgets = new Set(
      shapesGraph
        .getQuads(null, widgetPredicate)
        .filter(
          (quad) => quad.object.termType === "NamedNode" && isShapeNode(quad.subject, shapesGraph),
        )
        .map((quad) => quad.object.value),
    );

    for (const widgetValue of declaredWidgets) {
      if (alreadyScoredWidgets.has(widgetValue)) continue;

      const widget = factory.namedNode(widgetValue);
      const widgetScore = factory.blankNode();
      const nodeShape = factory.blankNode();
      const propertyShape = factory.blankNode();

      prepared.addQuad(factory.quad(widgetScore, rdf("type"), shui("WidgetScore")));
      prepared.addQuad(factory.quad(widgetScore, shui("widget"), widget));
      prepared.addQuad(factory.quad(widgetScore, shui("score"), defaultScore));
      prepared.addQuad(factory.quad(widgetScore, shui("shapesGraphShape"), nodeShape));
      prepared.addQuad(factory.quad(nodeShape, rdf("type"), sh("NodeShape")));
      prepared.addQuad(factory.quad(nodeShape, sh("property"), propertyShape));
      prepared.addQuad(factory.quad(propertyShape, sh("path"), widgetPredicate));
      prepared.addQuad(factory.quad(propertyShape, sh("hasValue"), widget));
    }
  }

  return prepared;
}

// A shui:editor/shui:viewer value at a node that isn't itself a shape doesn't declare a widget
// (spec §4.3) - covers the common ways a node is recognizable as a shape without running full
// SHACL shape-expansion: an explicit sh:NodeShape/sh:PropertyShape type, sh:path (property shapes
// are frequently left untyped), a node-shape target declaration, or being referenced as a shape
// from elsewhere (sh:property, sh:node, sh:qualifiedValueShape, sh:not).
function isShapeNode(node: Term, shapesGraph: RdfStore): boolean {
  if (node.termType !== "NamedNode" && node.termType !== "BlankNode") return false;

  const ownMarkers = [
    [rdf("type"), sh("NodeShape")],
    [rdf("type"), sh("PropertyShape")],
    [sh("path"), null],
    [sh("targetClass"), null],
    [sh("targetNode"), null],
    [sh("targetSubjectsOf"), null],
    [sh("targetObjectsOf"), null],
  ] as const;
  if (
    ownMarkers.some(
      ([predicate, object]) => shapesGraph.getQuads(node, predicate, object).length > 0,
    )
  ) {
    return true;
  }

  const referencedAsShapeBy = [sh("property"), sh("node"), sh("qualifiedValueShape"), sh("not")];
  return referencedAsShapeBy.some(
    (predicate) => shapesGraph.getQuads(null, predicate, node).length > 0,
  );
}

export async function* select(props: SelectProps) {
  const { shapeNode, shapesGraph, widgetPredicate } = props;
  const widget = shapesGraph.getQuads(shapeNode, widgetPredicate)[0]?.object;

  if (widget) {
    const isAccepted = await accept({ ...props, widgetNode: widget });
    if (isAccepted) {
      yield widget as NamedNode;
      if (props.best) return;
    }
  }

  for await (const { widget } of score(props)) {
    const isAccepted = await accept({ ...props, widgetNode: widget });
    if (isAccepted) {
      yield widget as NamedNode;
      if (props.best) return;
    }
  }
}

type ScoreProps = {
  // The node to validate in the instance data. Omit to score based on the shape alone.
  focusNode?: Term;
  // The RDF graph containing the focus node. This is the instance data.
  dataGraph: RdfStore;
  // A shape IRI.
  shapeNode: Term;
  // The RDF graph containing the list of SHACL shapes.
  shapesGraph: RdfStore;
  // The RDF graph containing the Widget Score definitions.
  scoringGraph: RdfStore;

  widgetPredicate: Term;
};

/**
 *  The score function used to find the best widget or an ordered list of matches.
 */
export async function* score(props: ScoreProps): AsyncGenerator<WidgetScoreResult> {
  const { scoringGraph } = props;
  const widgetScores = [...scoringGraph.getQuads(null, rdf("type"), shui("WidgetScore"))]
    .map((quad) => {
      const widgetScore = quad.subject;
      const [scoreQuad] = scoringGraph.getQuads(widgetScore, shui("score"));
      const [widgetQuad] = scoringGraph.getQuads(widgetScore, shui("widget"));

      const widget = widgetQuad?.object;
      const score = scoreQuad ? parseFloat(scoreQuad.object.value) : NaN;

      if (!widget || isNaN(score)) {
        throw new Error(`Invalid Widget Score definition for ${widgetScore.value}`);
      }

      return { widgetScore, widget, score };
    })
    .sort((a, b) => {
      if (a.score === b.score) {
        if (a.widget.value === b.widget.value) return 0;
        return a.widget.value < b.widget.value ? -1 : 1;
      }
      return b.score - a.score;
    });

  for (const widgetScore of widgetScores) {
    const isMatch = await match({
      ...props,
      matcherNode: widgetScore.widgetScore,
    });

    if (!isMatch) continue;
    yield widgetScore;
  }
}

type matchProps = {
  // The node to validate. This is instance data.
  focusNode?: Term;
  // The RDF graph containing the focus node. This is the instance data.
  dataGraph: RdfStore;
  // A shape IRI.
  shapeNode: Term;
  // The RDF graph containing the list of SHACL shapes.
  shapesGraph: RdfStore;
  // The RDF graph containing the Widget Score definitions.
  scoringGraph: RdfStore;
  // The node that identifies the matcher.
  matcherNode: Term;
};

async function match({
  focusNode,
  dataGraph,
  shapeNode,
  shapesGraph,
  scoringGraph,
  matcherNode,
}: matchProps) {
  const matcherDataGraphShapeQuads = scoringGraph.getQuads(matcherNode, shui("dataGraphShape"));
  const matcherShapeGraphShapeQuads = scoringGraph.getQuads(matcherNode, shui("shapesGraphShape"));

  const matcherDataGraphShapes = matcherDataGraphShapeQuads.map((q) => q.object);
  const matcherShapeGraphShapes = matcherShapeGraphShapeQuads.map((q) => q.object);
  // Per spec (Matcher Function, step 1): a rule that requires a dataGraphShape check but
  // declares no shapesGraphShape at all can never match with no value to check it against.
  // A rule that combines both is not excluded this way - with no focus node, its dataGraphShape
  // half simply goes unverified and the match rests on its shapesGraphShape half alone (step 4),
  // e.g. so an explicitly-declared editor (shui:editor, always scored via a shapesGraphShape
  // check for that declaration) still matches before any value exists.
  if (!focusNode && matcherDataGraphShapes.length > 0 && matcherShapeGraphShapes.length === 0) {
    return false;
  }

  for (const matcherShapeGraphShape of matcherShapeGraphShapes) {
    const widgetIsValid = await validate({
      focusNode: shapeNode,
      targetGraph: shapesGraph,
      shapesGraph: scoringGraph,
      shapeNode: matcherShapeGraphShape,
    });
    if (!widgetIsValid) return false;
  }

  if (!focusNode) return true;

  for (const matcherDataGraphShape of matcherDataGraphShapes) {
    const widgetIsValid = await validate({
      focusNode,
      targetGraph: dataGraph,
      shapesGraph: scoringGraph,
      shapeNode: matcherDataGraphShape,
    });
    if (!widgetIsValid) return false;
  }

  return true;
}

type ValidateProps = {
  focusNode?: Term;
  targetGraph: RdfStore;
  shapeNode: Term;
  shapesGraph: RdfStore;
};

export async function validate({ focusNode, targetGraph, shapeNode, shapesGraph }: ValidateProps) {
  if (!shapeNode) return true;

  // A node with no properties of its own (e.g. a freshly created blank node whose fields are all
  // still empty) is not "missing" - it can still validly exist purely as the object of some other
  // triple (e.g. the triple that assigns it as a property's value in the first place). Literals
  // can't be a quad subject or object-checked this way at all, so this only applies to IRIs/blank
  // nodes, and only rules out focus nodes absent from targetGraph in every position.
  if (
    focusNode?.termType !== "Literal" &&
    targetGraph.getQuads(focusNode).length === 0 &&
    targetGraph.getQuads(null, null, focusNode).length === 0
  ) {
    return false;
  }

  // shacl-engine's validate() reports a vacuous conforms:true against a completely empty target
  // dataset (nothing to traverse, so nothing fails) instead of actually checking focusNode against
  // shapeNode - shapesGraph is used as filler instead in that case, which changes nothing observable
  // (an empty targetGraph had nothing to find either way).
  const dataset = targetGraph.size > 0 ? targetGraph.asDataset() : shapesGraph.asDataset();

  const shaclEngine = getShaclEngine(shapesGraph);
  try {
    const report = await shaclEngine.validate(
      {
        dataset,
        terms: [focusNode],
      },
      [{ terms: [shapeNode] }],
    );
    return report.conforms;
  } catch (error) {
    console.warn(`SHACL validation failed for shape ${shapeNode.value}:`, error);
    return false;
  }
}

type AcceptProps = {
  // The node to validate in the instance data.
  focusNode?: Term;
  // The RDF graph containing the focus node. This is the instance data.
  dataGraph: RdfStore;
  // A shape IRI.
  shapeNode: Term;
  // The RDF graph containing the list of SHACL shapes.
  shapesGraph: RdfStore;
  // The node that identifies the widget.
  widgetNode: Term;
  // The RDF graph containing the Widget Score definitions.
  scoringGraph: RdfStore;
};

export function accept({
  focusNode,
  dataGraph,
  shapeNode,
  shapesGraph,
  widgetNode,
  scoringGraph,
}: AcceptProps) {
  const matcherQuad = [
    ...scoringGraph.getQuads(null, rdf("type"), shui("WidgetAcceptMatcher"), null),
  ].find((quad) => {
    const [matcherWidgetQuad] = scoringGraph.getQuads(
      quad.subject,
      shui("widget"),
      widgetNode,
      null,
    );
    return !!matcherWidgetQuad;
  });

  if (!matcherQuad) return true;

  return match({
    focusNode,
    dataGraph,
    shapeNode,
    shapesGraph,
    scoringGraph,
    matcherNode: matcherQuad.subject,
  });
}

// Compiling a ShaclEngine parses every shape in shapesGraph up front (see shacl-engine's
// Engine constructor), which is wasted work when repeated for the same shapesGraph - as
// happens here, since matcher() always validates against the same scoringGraph, once or twice
// per candidate widget. Keyed by object identity (scoringGraph is a stable, cached instance per
// registry.ts), so this never serves a stale engine for a graph that's actually changed.
const shaclEngineCache = new WeakMap<RdfStore, ShaclEngine>();

function getShaclEngine(shapesGraph: RdfStore): ShaclEngine {
  let shaclEngine = shaclEngineCache.get(shapesGraph);
  if (!shaclEngine) {
    shaclEngine = new ShaclEngine(shapesGraph.asDataset(), { factory });
    shaclEngineCache.set(shapesGraph, shaclEngine);
  }
  return shaclEngine;
}
