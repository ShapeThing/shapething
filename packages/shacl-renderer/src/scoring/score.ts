import type { NamedNode, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { shui } from "@/helpers/namespaces.ts";
import {
  allValid,
  hasType,
  objects,
  orderedWidgetScores,
} from "@/scoring/helpers.ts";

type BaseProps = {
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
};

type PublicInterfaceProps = BaseProps & {
  // The mode predicate: shui:editor, shui:viewer or st:facet. WidgetScores and
  // WidgetAcceptMatchers name their widget through it, so a rule only ever applies to the mode
  // it is declared under.
  widgetPredicate: Term;
};

/**
 * Selects the best widget.
 */
export async function select(
  props: PublicInterfaceProps,
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

  for (
    const widgetScore of orderedWidgetScores(scoringGraph, widgetPredicate)
  ) {
    const widgetIRI = widgetScore.widget;

    const isMatch = await match({
      ...props,
      matcherNode: widgetScore.widgetScore,
    });

    if (isMatch) {
      const isAccepted = await accept({ ...props, widgetIRI });
      if (isAccepted) {
        return widgetIRI as NamedNode;
      }
    }
  }
}

export type WidgetScoreResult = {
  widget: Term;
  widgetScore: Term;
  score: number;
};

/**
 *  Returns all applicable widgets scored.
 */
export async function score(
  props: PublicInterfaceProps,
): Promise<Array<WidgetScoreResult>> {
  const { scoringGraph, widgetPredicate } = props;

  const widgetScores = orderedWidgetScores(scoringGraph, widgetPredicate);

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

type matchProps = BaseProps & {
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
  const matcherDataGraphShapes = objects(
    scoringGraph,
    matcherNode,
    shui("dataGraphShape"),
  );
  const matcherShapeGraphShapes = objects(
    scoringGraph,
    matcherNode,
    shui("shapesGraphShape"),
  );

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
  // otherwise re-run the identical validation several times over - see cachedValidate in helpers.ts.
  const shapeIsValid = await allValid(
    { focusNode: shapeNode, targetGraph: shapesGraph, shapesGraph: scoringGraph },
    matcherShapeGraphShapes,
  );
  if (!shapeIsValid) return false;

  if (!focusNode) return true;

  return allValid(
    { focusNode, targetGraph: dataGraph, shapesGraph: scoringGraph },
    matcherDataGraphShapes,
  );
}

type AcceptProps = PublicInterfaceProps & {
  // The node that identifies the widget.
  widgetIRI: Term;
};

export async function accept(props: AcceptProps): Promise<boolean> {
  const { scoringGraph, widgetPredicate, widgetIRI } = props;
  const matcherQuad = scoringGraph
    .getQuads(null, widgetPredicate, widgetIRI)
    .find((quad) =>
      hasType(scoringGraph, quad.subject, shui("WidgetAcceptMatcher"))
    );

  if (!matcherQuad) return true;

  return match({ ...props, matcherNode: matcherQuad.subject });
}
