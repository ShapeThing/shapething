import { useId, useMemo } from "react";
import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { sh, st } from "@/helpers/namespaces.ts";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { aggregateFacetValues } from "@/structure/facetValues.ts";
import {
  getFilterConstraintNode,
  setFilterConstraint,
  type FilterShape,
} from "@/structure/filterShape.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { FacetWidgetComponent } from "@/widgets/types.ts";

type Props = {
  property: PropertyUIElement;
  filterShape: FilterShape;
  instances: Quad_Subject[];
};

/**
 * Renders one property as a facet: resolves the highest-scoring st:facet widget (same scoring
 * engine as edit/view's shui:editor/shui:viewer, see scoring/score.ts), aggregates this property's
 * actual values across every target instance (structure/facetValues.ts - there is no single
 * focusNode in facet mode), and binds the widget's getConstraint/setConstraint to this property's
 * own constraint node on the live, generated filterShape (structure/filterShape.ts).
 */
export default function FacetPropertyComponent({ property, filterShape, instances }: Props) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const widget = useWidget<FacetWidgetComponent>(st("facet"), property);
  const values = useMemo(() => aggregateFacetValues(property, instances), [property, instances]);
  const constraintNode = useMemo(
    () => getFilterConstraintNode(filterShape, property),
    [filterShape, property],
  );

  const labelId = useId();
  const label = property.label([activeInterfaceLanguage]);
  const description = property.get(sh("description"), [activeInterfaceLanguage])?.value;

  // Reactive (see helpers/reactiveRdfStore.ts) - a facet widget's own setConstraint call mutates
  // filterShape.store directly, not through React state, so without this the widget would never
  // re-render to reflect its own write (e.g. a controlled checkbox's `checked` prop would go stale
  // the instant it's clicked, snapping back visually). Reading every quad on constraintNode (not
  // just one predicate) means any predicate this widget writes - including sh:in swapping to a
  // freshly rebuilt list head - retriggers this.
  const constraintQuads = useReactiveRead(filterShape.store, constraintNode.value, () =>
    filterShape.store.getQuads(constraintNode),
  );

  if (!widget) return null;
  const { Widget } = widget;

  // sh:in-style predicates point at an rdf:List head, not the values directly - expandListOrTerm
  // (the same helper constraintResolutions.ts's own sh:in handling uses) normalizes both that and
  // a plain single-valued predicate (e.g. sh:minInclusive) to "the actual current value(s)".
  const getConstraint = (predicate: NamedNode): Term[] =>
    constraintQuads
      .filter((quad) => quad.predicate.equals(predicate))
      .flatMap((quad) => expandListOrTerm(quad.object, filterShape.store));

  const setConstraint = (predicate: NamedNode, value: Term | Term[] | undefined) =>
    setFilterConstraint(filterShape, constraintNode, predicate, value);

  return (
    <FormElement label={label} showColon labelId={labelId} tooltip={description}>
      <Widget
        shape={property}
        values={values}
        getConstraint={getConstraint}
        setConstraint={setConstraint}
        labelledBy={labelId}
      />
    </FormElement>
  );
}
