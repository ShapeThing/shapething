import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { Validator as ShaclEngine } from "shacl-engine";
import { factory } from "@/helpers/factory.ts";
import { rdf, shui } from "@/helpers/namespaces.ts";

type ScoreProps = {
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
  widgetScore: Term;
  widget: Term;
  score: number;
};

export async function* select(props: ScoreProps) {
  const { shapeNode, shapesGraph, widgetPredicate } = props;
  const widget = shapesGraph.getQuads(shapeNode, widgetPredicate)[0]?.object;

  if (widget) {
    const isAccepted = await accept({ ...props, widgetNode: widget });
    if (isAccepted) {
      yield widget;
      return;
    }
  }

  for await (const { widget } of score(props)) {
    const isAccepted = await accept({ ...props, widgetNode: widget });
    if (isAccepted) {
      yield widget;
    }
  }
}

/**
 *  The score function used to find the best widget or an ordered list of matches.
 */
export async function* score(
  props: ScoreProps,
): AsyncGenerator<WidgetScoreResult> {
  const { best, scoringGraph } = props;
  const widgetScores = [
    ...scoringGraph.getQuads(null, rdf("type"), shui("WidgetScore")),
  ]
    .map((quad) => {
      const widgetScore = quad.subject;
      const [scoreQuad] = scoringGraph.getQuads(widgetScore, shui("score"));
      const [widgetQuad] = scoringGraph.getQuads(widgetScore, shui("widget"));

      const widget = widgetQuad?.object;
      const score = scoreQuad ? parseFloat(scoreQuad.object.value) : NaN;

      if (!widget || isNaN(score)) {
        throw new Error(
          `Invalid Widget Score definition for ${widgetScore.value}`,
        );
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
    const isMatch = await matcher({
      ...props,
      matcherNode: widgetScore.widgetScore,
    });

    if (!isMatch) continue;
    yield widgetScore;

    if (best) return;
  }
}

type matcherProps = {
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

async function matcher({
  focusNode,
  dataGraph,
  shapeNode,
  shapesGraph,
  scoringGraph,
  matcherNode,
}: matcherProps) {
  const matcherDataGraphShapeQuads = scoringGraph.getQuads(
    matcherNode,
    shui("dataGraphShape"),
  );
  const matcherShapeGraphShapeQuads = scoringGraph.getQuads(
    matcherNode,
    shui("shapesGraphShape"),
  );

  const matcherDataGraphShapes = matcherDataGraphShapeQuads.map((q) =>
    q.object
  );
  const matcherShapeGraphShapes = matcherShapeGraphShapeQuads.map((q) =>
    q.object
  );
  if (
    !focusNode && matcherDataGraphShapes.length &&
    matcherShapeGraphShapes.length === 0
  ) {
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

// Compiling a ShaclEngine parses every shape in shapesGraph up front (see shacl-engine's
// Validator constructor), which is wasted work when repeated for the same shapesGraph - as
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

async function validate(
  { focusNode, targetGraph, shapeNode, shapesGraph }: ValidateProps,
) {
  if (!shapeNode) return true;

  // Literals can't be a quad subject, so the existence check only applies to IRIs/blank nodes.
  if (
    focusNode?.termType !== "Literal" &&
    targetGraph.getQuads(focusNode).length === 0
  ) {
    return false;
  }
  const shaclEngine = getShaclEngine(shapesGraph);
  try {
    const report = await shaclEngine.validate(
      {
        dataset: targetGraph.asDataset(),
        terms: [focusNode],
      },
      [{ terms: [shapeNode] }],
    );
    return report.conforms;
  } catch (error) {
    console.warn(
      `SHACL validation failed for shape ${shapeNode.value}:`,
      error,
    );
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
    ...scoringGraph.getQuads(
      null,
      rdf("type"),
      shui("WidgetAcceptMatcher"),
      null,
    ),
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

  return matcher({
    focusNode,
    dataGraph,
    shapeNode,
    shapesGraph,
    scoringGraph,
    matcherNode: matcherQuad.subject,
  });
}
