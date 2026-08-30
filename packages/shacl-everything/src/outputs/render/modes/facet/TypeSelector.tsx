import { useId, useMemo } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh, st, xsd } from "@/helpers/namespaces.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import {
  getFilterConstraintNode,
  setFilterConstraint,
  type FilterShape,
} from "@/structure/filterShape.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { FacetWidgetComponent, Widgets } from "@/widgets/types.ts";

type Props = {
  rootShapes: Quad_Subject[];
  classFor: (rootShape: Quad_Subject) => Term;
  dataGraph: RdfStore;
  scoresGraph: RdfStore;
  widgets?: Widgets;
  filterShape: FilterShape;
  selectedRootShape: Quad_Subject;
  onSelectRootShape: (rootShape: Quad_Subject) => void;
};

/**
 * The root "what kind of thing am I filtering" facet, shown only when more than one facetable root
 * shape was discovered (see NodeUIComponent). Not a real property declared anywhere in
 * shapesGraph - a synthetic one (sh:path rdf:type, sh:in the class every discovered root shape
 * represents, sh:maxCount 1 so CategoryFacet renders it single-select - multiple simultaneous root
 * shapes is out of this plan's scope), rendered through the exact same st:facet widget-resolution
 * path as any real property. Picking a value both writes the normal sh:property [sh:path rdf:type;
 * sh:in (...)] constraint onto filterShape (an ordinary facet constraint, nothing special) and
 * drives which root shape's own properties render below (onSelectRootShape).
 */
export default function TypeSelector({
  rootShapes,
  classFor,
  dataGraph,
  scoresGraph,
  widgets,
  filterShape,
  selectedRootShape,
  onSelectRootShape,
}: Props) {
  const placeholderFocusNode = useMemo(() => factory.blankNode(), []);

  const property = useMemo(() => {
    const syntheticGraph = RdfStore.createDefault();
    const shapeNode = factory.blankNode();
    const classes = rootShapes.map((rootShape) => classFor(rootShape));
    const list = rebuildRdfList(rdf("nil"), classes, syntheticGraph);

    syntheticGraph.addQuad(factory.quad(shapeNode, sh("path"), rdf("type")));
    syntheticGraph.addQuad(factory.quad(shapeNode, sh("in"), list as never));
    syntheticGraph.addQuad(
      factory.quad(shapeNode, sh("maxCount"), factory.literal("1", xsd("integer"))),
    );

    return new PropertyUIElement({
      shapesGraph: syntheticGraph,
      dataGraph,
      scoresGraph,
      widgetRegistry: widgets,
      focusNode: placeholderFocusNode,
      propertyShapes: [shapeNode as NamedNode],
    });
  }, [rootShapes, classFor, dataGraph, scoresGraph, widgets, placeholderFocusNode]);

  const widget = useWidget<FacetWidgetComponent>(st("facet"), property);
  const constraintNode = useMemo(
    () => getFilterConstraintNode(filterShape, property),
    [filterShape, property],
  );
  const labelId = useId();

  // Reactive - see FacetPropertyComponent's identical use of this; without it the widget's own
  // setConstraint write wouldn't re-render it to reflect its own change (e.g. a controlled radio
  // button's `checked` prop going stale the instant it's clicked).
  const constraintQuads = useReactiveRead(filterShape.store, constraintNode.value, () =>
    filterShape.store.getQuads(constraintNode),
  );

  if (!widget) return null;
  const { Widget } = widget;

  const getConstraint = (predicate: NamedNode): Term[] =>
    constraintQuads
      .filter((quad) => quad.predicate.equals(predicate))
      .flatMap((quad) => expandListOrTerm(quad.object, filterShape.store));

  const setConstraint = (predicate: NamedNode, value: Term | Term[] | undefined) => {
    setFilterConstraint(filterShape, constraintNode, predicate, value);
    if (!predicate.equals(sh("in")) || !Array.isArray(value) || value.length === 0) return;

    const chosen = value[0];
    const matchedRoot = rootShapes.find((rootShape) => classFor(rootShape).equals(chosen));
    if (matchedRoot && !matchedRoot.equals(selectedRootShape)) onSelectRootShape(matchedRoot);
  };

  return (
    <FormElement
      label={<Localized id="facet-type-selector-label">Type</Localized>}
      labelId={labelId}
      showColon
    >
      <Widget
        shape={property}
        values={[]}
        getConstraint={getConstraint}
        setConstraint={setConstraint}
        labelledBy={labelId}
      />
    </FormElement>
  );
}
