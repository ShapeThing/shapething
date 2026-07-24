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

  const processedWidget = await processWidget(widget, props);
  if (processedWidget) {
    yield processedWidget;
    return;
  }

  for await (const { widget } of score(props)) {
    const processedWidget = await processWidget(widget, props);
    if (processedWidget) {
      yield processedWidget;
    }
  }
}

/**
 *  The score function used to find the best widget or an ordered list of matches.
 */
export async function* score({
  best,
  focusNode,
  dataGraph,
  shapeNode,
  shapesGraph,
  scoringGraph,
}: ScoreProps): AsyncGenerator<WidgetScoreResult> {
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
        return a.widget.value.localeCompare(b.widget.value);
      }
      return b.score - a.score;
    });

  for (const widgetScore of widgetScores) {
    const isMatch = await matcher({
      focusNode,
      dataGraph,
      shapeNode,
      shapesGraph,
      scoringGraph,
      matcherNode: widgetScore.widgetScore,
    });

    if (!isMatch) continue;
    yield widgetScore;

    if (best) return;
  }
}

/**
 * Processes a widget to determine if it matches the given SHACL shape and scoring criteria.
 */
const processWidget = async (widget: Term, props: ScoreProps) => {
  if (widget) {
    const [widgetAcceptMatcher] = props.scoringGraph
      .getQuads(null, rdf("type"), shui("WidgetAcceptMatcher"))
      .filter((quad) => {
        const [matcherWidgetQuad] = props.scoringGraph.getQuads(
          quad.subject,
          shui("widget"),
          widget,
        );
        return !!matcherWidgetQuad;
      });

    if (!widgetAcceptMatcher) {
      // If no matcher is defined for the widget, it is allowed by spec.
      return widget;
    } else {
      const isMatch = await matcher({
        ...props,
        matcherNode: widgetAcceptMatcher.subject,
      });

      if (isMatch) {
        return widget;
      } else {
        return;
      }
    }
  }
};

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
  const [matcherDataGraphShapeQuad] = scoringGraph.getQuads(
    matcherNode,
    shui("dataGraphShape"),
    null,
    null,
  );
  const matcherShapeGraphShapeQuads = scoringGraph.getQuads(
    matcherNode,
    shui("shapesGraphShape"),
    null,
    null,
  );

  const matcherDataGraphShape = matcherDataGraphShapeQuad?.object;
  const matcherShapeGraphShapes = matcherShapeGraphShapeQuads.map((q) => q.object);
  // A widget does not match if its score shape does not specify scores for property shapes and no focus node of the instance data has been given.
  if (!focusNode && matcherDataGraphShape && matcherShapeGraphShapes.length === 0) {
    return false;
  }

  for (const matcherShapeGraphShape of matcherShapeGraphShapes) {
    const widgetIsValid = await validate({
      focusNode: shapeNode,
      targetGraph: shapesGraph,
      shapeNode: matcherShapeGraphShape,
      shapesGraph: scoringGraph,
    });
    if (!widgetIsValid) return false;
  }

  if (!focusNode) return true;

  return validate({
    focusNode,
    targetGraph: dataGraph,
    shapeNode: matcherDataGraphShape,
    shapesGraph: scoringGraph,
  });
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

async function validate({ focusNode, targetGraph, shapeNode, shapesGraph }: ValidateProps) {
  if (!shapeNode) return true;

  // Literals can't be a quad subject, so the existence check only applies to IRIs/blank nodes.
  if (focusNode?.termType !== "Literal" && targetGraph.getQuads(focusNode).length === 0) {
    return false;
  }
  const shaclEngine = getShaclEngine(shapesGraph);
  const report = await shaclEngine.validate(
    {
      dataset: targetGraph.asDataset(),
      terms: [focusNode],
    },
    [{ terms: [shapeNode] }],
  );
  return report.conforms;
}

type AcceptProps = {
  // The node to validate in the instance data.
  focusNode: Term;
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
  const matcherNode = [
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

  if (!matcherNode) return false;

  return matcher({
    focusNode,
    dataGraph,
    shapeNode,
    shapesGraph,
    scoringGraph,
    matcherNode,
  });
}
