import { useId, useMemo } from "react";
import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { sh, st } from "@/helpers/namespaces.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import {
  aggregateFacetValueCounts,
  aggregateFacetValues,
  countFacetInstancesInRange,
  countFacetInstancesMatchingPattern,
} from "@/structure/facetValues.ts";
import {
  findFilterConstraintNode,
  instancesMatchingOtherConstraints,
  pathSparqlFor,
  setFilterConstraintForProperty,
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
  const { enableFacetOptionCounts } = useEnvironment();
  const widget = useWidget<FacetWidgetComponent>(st("facet"), property);
  // The option list itself (values) always reflects every target instance, so an option with
  // (currently) zero matches still shows up rather than disappearing - only its *count* narrows.
  const values = useMemo(() => aggregateFacetValues(property, instances), [property, instances]);

  const labelId = useId();
  const label = property.label([activeInterfaceLanguage]);
  const description = property.get(sh("description"), [activeInterfaceLanguage])?.value;

  // Reactive (see helpers/reactiveRdfStore.ts) - a facet widget's own setConstraint call mutates
  // filterShape.store directly, not through React state, so without this the widget would never
  // re-render to reflect its own write (e.g. a controlled checkbox's `checked` prop would go stale
  // the instant it's clicked, snapping back visually). The find itself (not just a resolved node's
  // quads) is tracked, so that when setConstraint later auto-vivifies this property's sh:property
  // node for the first time, the write (which touches rootNode/sh:property) retriggers this read
  // rather than leaving it stuck on "nothing found yet".
  const constraintQuads = useReactiveRead(
    filterShape.store,
    `${filterShape.rootNode.value}|${pathSparqlFor(property) ?? ""}`,
    () => {
      const node = findFilterConstraintNode(filterShape, property);
      return node ? filterShape.store.getQuads(node) : [];
    },
  );

  // `instances` narrowed to whatever satisfies every *other* currently-active facet constraint -
  // what makes valueCounts/rangeMatchCount below real faceted counts ("how many results would this
  // leave, given what's already selected elsewhere") instead of a static tally against every
  // target instance regardless of other filters. Reactive for the same reason constraintQuads is
  // above: the read touches every sh:property node's own constraint quads, so a sibling facet's
  // own setConstraint call - anywhere - correctly retriggers this. Skipped (falls back to the full
  // `instances`, no per-instance walk) when counts are off.
  const narrowedInstances = useReactiveRead(
    filterShape.store,
    `${filterShape.rootNode.value}|narrow|${pathSparqlFor(property) ?? ""}`,
    () =>
      enableFacetOptionCounts
        ? instancesMatchingOtherConstraints(
            filterShape,
            property.dataGraph,
            instances,
            pathSparqlFor(property),
          )
        : instances,
  );

  const valueCounts = useMemo(
    () =>
      enableFacetOptionCounts ? aggregateFacetValueCounts(property, narrowedInstances) : undefined,
    [enableFacetOptionCounts, property, narrowedInstances],
  );

  // sh:in-style predicates point at an rdf:List head, not the values directly - expandListOrTerm
  // (the same helper constraintResolutions.ts's own sh:in handling uses) normalizes both that and
  // a plain single-valued predicate (e.g. sh:minInclusive) to "the actual current value(s)".
  const getConstraint = (predicate: NamedNode): Term[] =>
    constraintQuads
      .filter((quad) => quad.predicate.equals(predicate))
      .flatMap((quad) => expandListOrTerm(quad.object, filterShape.store));

  // A range widget writes sh:minInclusive/sh:maxInclusive through the very same setConstraint
  // this component hands it, so getConstraint already reflects whatever the user just typed -
  // no separate callback needed for a range widget to report its own bounds back up. Only
  // computed once at least one bound is actually set (an untouched range facet has neither), and
  // gated the same way valueCounts is.
  const minBound = getConstraint(sh("minInclusive"))[0];
  const maxBound = getConstraint(sh("maxInclusive"))[0];
  const rangeMatchCount = useMemo(
    () =>
      enableFacetOptionCounts && (minBound !== undefined || maxBound !== undefined)
        ? countFacetInstancesInRange(property, narrowedInstances, minBound, maxBound)
        : undefined,
    [enableFacetOptionCounts, property, narrowedInstances, minBound, maxBound],
  );

  // Same idea as rangeMatchCount, for TextSearchFacet's own sh:pattern instead of a numeric/date
  // range - only computed once something has actually been typed (an untouched search facet has
  // no sh:pattern yet).
  const patternBound = getConstraint(sh("pattern"))[0];
  const flagsBound = getConstraint(sh("flags"))[0];
  const searchMatchCount = useMemo(
    () =>
      enableFacetOptionCounts && patternBound !== undefined
        ? countFacetInstancesMatchingPattern(
            property,
            narrowedInstances,
            patternBound.value,
            flagsBound?.value,
          )
        : undefined,
    [enableFacetOptionCounts, property, narrowedInstances, patternBound, flagsBound],
  );

  if (!widget) return null;
  const { Widget } = widget;

  // Only auto-vivifies this property's sh:property/sh:path node on an actual write - clearing a
  // value back to "empty" (undefined, or a `[]`) never creates one, and if none exists yet there's
  // nothing to clear, so no property path is written until the user has actually given some input.
  // setFilterConstraintForProperty (not getFilterConstraintNode + setFilterConstraint as two
  // separate calls) is what keeps a brand-new node's own reactive read from observing it half-
  // written - see that function's own doc comment.
  const setConstraint = (predicate: NamedNode, value: Term | Term[] | undefined) =>
    setFilterConstraintForProperty(filterShape, property, predicate, value);

  return (
    <FormElement label={label} showColon labelId={labelId} tooltip={description}>
      <Widget
        shape={property}
        values={values}
        getConstraint={getConstraint}
        setConstraint={setConstraint}
        valueCounts={valueCounts}
        rangeMatchCount={rangeMatchCount}
        searchMatchCount={searchMatchCount}
        labelledBy={labelId}
      />
    </FormElement>
  );
}
