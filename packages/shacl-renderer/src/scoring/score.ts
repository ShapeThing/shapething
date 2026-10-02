import type { NamedNode, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { rdf, shui } from "@/helpers/namespaces.ts";
import type { Widgets } from "@/widgets/types.ts";
import {
  cachedValidate,
  compareScored,
  orderByScore,
} from "@/scoring/helpers.ts";

type SelectProps = {
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
  // shui:editor, shui:viewer or st:facet.
  widgetPredicate: Term;
};

/**
 * Selects the best widget.
 */
export async function select(
  props: SelectProps,
): Promise<NamedNode | undefined> {
  const { shapeNode, shapesGraph, widgetPredicate, scoringGraph } = props;
  const hardWiredWidget = shapesGraph.getQuads(shapeNode, widgetPredicate)[0]
    ?.object;

  if (hardWiredWidget) {
    const isAccepted = await accept({ ...props, widgetIRI: hardWiredWidget });
    if (isAccepted) {
      return hardWiredWidget as NamedNode;
    }
  }

  const widgetScores = scoringGraph.getQuads(null, widgetPredicate).filter((
    quad,
  ) =>
    scoringGraph.getQuads(quad.subject, rdf("type"), shui("WidgetScore"))
      .length > 0
  );

  const widgetScoresOrdered = orderByScore(
    widgetScores,
    scoringGraph,
  );

  for (const widgetScore of widgetScoresOrdered) {
    const widgetIRI = widgetScore.object;

    const scoreIsAllowed = await match({
      ...props,
      matcherNode: widgetScore.subject,
    });

    if (scoreIsAllowed) {
      const isAccepted = await accept({ ...props, widgetIRI });
      if (isAccepted) {
        return widgetIRI as NamedNode;
      }
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

  // See SelectProps' own widgets doc above - identical purpose, just threaded to score() directly
  // rather than only via select()'s pass-through.
  widgets?: Widgets;
};

export type WidgetScoreResult = {
  widget: Term;
  widgetScore: Term;
  score: number;
};

/**
 *  Returns all applicable widgets scored.
 */
export async function score(
  props: ScoreProps,
): Promise<Array<WidgetScoreResult>> {
  const { scoringGraph, widgetPredicate } = props;

  const widgetScores = scoringGraph.getQuads(null, widgetPredicate)
    .filter((quad) =>
      scoringGraph.getQuads(quad.subject, rdf("type"), shui("WidgetScore"))
        .length > 0
    )
    .map((quad) => {
      const widgetScore = quad.subject;
      const [scoreQuad] = scoringGraph.getQuads(widgetScore, shui("score"));
      const [widgetQuad] = scoringGraph.getQuads(widgetScore, widgetPredicate);

      const widget = widgetQuad.object;
      const score = scoreQuad ? parseFloat(scoreQuad.object.value) : NaN;

      if (isNaN(score)) {
        throw new Error(
          `Invalid Widget Score definition for ${widgetScore.value}`,
        );
      }

      return { widgetScore, widget, score };
    })
    .sort(compareScored);

  const results: Array<WidgetScoreResult> = [];

  for (const widgetScore of widgetScores) {
    const isMatch = await match({
      ...props,
      matcherNode: widgetScore.widgetScore,
    });

    if (!isMatch) continue;

    const isAccepted = await accept({
      ...props,
      widgetIRI: widgetScore.widget,
    });
    if (!isAccepted) continue;

    results.push(widgetScore);
  }

  return results;
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
}: matchProps): Promise<boolean> {
  const matcherDataGraphShapes = scoringGraph.getQuads(
    matcherNode,
    shui("dataGraphShape"),
  ).map((q) => q.object);

  const matcherShapeGraphShapes = scoringGraph.getQuads(
    matcherNode,
    shui("shapesGraphShape"),
  ).map((q) => q.object);

  // Nothing to validate here.
  if (
    !focusNode && matcherDataGraphShapes.length &&
    matcherShapeGraphShapes.length === 0
  ) {
    return false;
  }

  // Multiple WidgetScore/WidgetAcceptMatcher rules commonly share the exact same
  // shui:shapesGraphShape/shui:dataGraphShape (e.g. AutoCompleteEditor/score.ttl's two WidgetScore
  // rules and its WidgetAcceptMatcher all point at shui:isIRI), so one select()/score() call can
  // otherwise re-run the identical validation several times over - see cachedValidate below.
  for (const matcherShapeGraphShape of matcherShapeGraphShapes) {
    const widgetIsValid = await cachedValidate({
      focusNode: shapeNode,
      targetGraph: shapesGraph,
      shapesGraph: scoringGraph,
      shapeNode: matcherShapeGraphShape,
    });
    if (!widgetIsValid) return false;
  }

  if (!focusNode) return true;

  for (const matcherDataGraphShape of matcherDataGraphShapes) {
    const widgetIsValid = await cachedValidate({
      focusNode,
      targetGraph: dataGraph,
      shapesGraph: scoringGraph,
      shapeNode: matcherDataGraphShape,
    });
    if (!widgetIsValid) return false;
  }

  return true;
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
  widgetIRI: Term;
  // The RDF graph containing the Widget Score definitions.
  scoringGraph: RdfStore;
  // The mode predicate (shui:editor/shui:viewer/st:facet) a WidgetAcceptMatcher names its widget
  // through - same predicate score()/select() score against, so a matcher only ever declares its
  // widget under the category it actually applies to.
  widgetPredicate: Term;
};

export async function accept({
  focusNode,
  dataGraph,
  shapeNode,
  shapesGraph,
  widgetIRI,
  scoringGraph,
  widgetPredicate,
}: AcceptProps): Promise<boolean> {
  const matcherQuad = scoringGraph
    .getQuads(null, widgetPredicate, widgetIRI)
    .find((quad) =>
      scoringGraph.getQuads(
        quad.subject,
        rdf("type"),
        shui("WidgetAcceptMatcher"),
      ).length > 0
    );

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
