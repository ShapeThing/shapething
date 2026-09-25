import { useId, useMemo } from "react";
import type { NamedNode, Term } from "@rdfjs/types";
import { sh, st } from "@/helpers/namespaces.ts";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import {
  findFilterConstraintNode,
  hasFilterConstraint,
  pathSparqlFor,
  readFilterConstraint,
  setFilterConstraintForProperty,
  setFilterConstraintsForProperty,
  type FilterShape,
} from "@/facets/filterShape.ts";
import {
  FacetPropertyDataProvider,
  useFacetMatchCount,
} from "@/outputs/render/modes/facet/facetData.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { searchQueryFor } from "@/widgets/implementations/shui/editors/AutoCompleteEditor/searchQuery.ts";
import type { FacetWidgetComponent } from "@/widgets/types.ts";
import WidgetErrorBoundary from "@/outputs/render/components/WidgetErrorBoundary/index.tsx";

type Props = {
  property: PropertyUIElement;
  filterShape: FilterShape;
};

// The predicates whose presence means this facet narrows by one overall condition (a range, a text
// search, a drawn area) rather than by picking options - such a facet shows a single match count on
// its label instead of per-option counts.
const SINGLE_CONDITION_PREDICATES = [
  sh("minInclusive"),
  sh("maxInclusive"),
  sh("minExclusive"),
  sh("maxExclusive"),
  sh("pattern"),
  st("withinArea"),
];

/**
 * Renders one property as a facet: resolves the highest-scoring st:facet widget (same scoring
 * engine as edit/view's shui:editor/shui:viewer, see scoring/score.ts), binds the widget's
 * getConstraint/setConstraint to this property's own constraint node on the live, generated
 * filterShape (facets/filterShape.ts), and provides the property's path to the facet data hooks
 * (modes/facet/facetData.tsx) the widget pulls its values/counts/bounds through.
 */
export default function FacetPropertyComponent({ property, filterShape }: Props) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const widget = useWidget<FacetWidgetComponent>(st("facet"), property);
  const pathSparql = useMemo(() => pathSparqlFor(property), [property]);

  const labelId = useId();
  const label = property.label([activeInterfaceLanguage]);
  const description = property.description([activeInterfaceLanguage]);

  // Reactive (see helpers/reactiveRdfStore.ts) - a facet widget's own setConstraint call mutates
  // filterShape.store directly, not through React state, so without this the widget would never
  // re-render to reflect its own write (e.g. a controlled checkbox's `checked` prop would go stale
  // the instant it's clicked). The find itself is tracked too, so the write that auto-vivifies this
  // property's sh:property node for the first time retriggers this read. Resolves every predicate's
  // value(s) inside the read - including ones nested in the node's sh:qualifiedValueShape and RDF
  // list cells - so all of it is tracked.
  const constraint = useReactiveRead(
    filterShape.store,
    `${filterShape.rootNode.value}|${pathSparql ?? ""}`,
    () => {
      const node = findFilterConstraintNode(filterShape, property);
      const values = new Map<string, Term[]>();
      const present = new Set<string>();
      if (node) {
        for (const predicate of [...SINGLE_CONDITION_PREDICATES, sh("in"), sh("flags"), st("colorBucket"), st("classIn")]) {
          values.set(predicate.value, readFilterConstraint(filterShape, node, predicate));
          if (hasFilterConstraint(filterShape, node, predicate)) present.add(predicate.value);
        }
        for (const quad of filterShape.store.getQuads(node)) {
          if (!values.has(quad.predicate.value)) {
            values.set(quad.predicate.value, readFilterConstraint(filterShape, node, quad.predicate as NamedNode));
            present.add(quad.predicate.value);
          }
        }
      }
      return { values, present };
    },
  );

  const getConstraint = (predicate: NamedNode): Term[] => constraint.values.get(predicate.value) ?? [];

  // A search facet over a property declaring shui:searchQuery writes the query's matches as an
  // sh:in instead of an sh:pattern (see TextSearchFacet) - still a single overall condition, unlike
  // CategoryFacet/SubClassFacet's option picks. An explicit empty sh:in (no search results) counts.
  const hasSearchQuery = useMemo(() => searchQueryFor(property) !== undefined, [property]);
  const singleConditionActive =
    SINGLE_CONDITION_PREDICATES.some((predicate) => constraint.present.has(predicate.value)) ||
    (hasSearchQuery && constraint.present.has(sh("in").value));
  const matchCount = useFacetMatchCount(singleConditionActive);

  const propertyData = useMemo(() => ({ pathSparql }), [pathSparql]);

  if (!widget) return null;
  const { Widget } = widget;

  // Only auto-vivifies this property's sh:property/sh:path node on an actual write - clearing a
  // value back to "empty" (undefined, or a `[]`) never creates one. setFilterConstraintForProperty
  // (not getFilterConstraintNode + setFilterConstraint as two separate calls) is what keeps a
  // brand-new node's own reactive read from observing it half-written - see its doc comment.
  const setConstraint = (predicate: NamedNode, value: Term | Term[] | undefined) =>
    setFilterConstraintForProperty(filterShape, property, predicate, value);

  // For a widget that needs to write more than one predicate as a single user gesture - see
  // setFilterConstraintsForProperty's own doc comment for why two separate setConstraint calls
  // can't safely stand in for this on a property no facet has touched yet.
  const setConstraints = (entries: ReadonlyArray<readonly [NamedNode, Term | Term[] | undefined]>) =>
    setFilterConstraintsForProperty(filterShape, property, entries);

  return (
    <FormElement
      label={label}
      actions={
        singleConditionActive &&
        matchCount !== undefined && <span className="st-form-element__count-badge">{matchCount}</span>
      }
      showColon
      labelId={labelId}
      tooltip={description}
    >
      {/* Same per-widget isolation as edit/view mode's WidgetSlot - a crashing facet widget
          replaces only itself, not the whole facet form. */}
      <WidgetErrorBoundary resetKeys={[widget.iri.value]} widget={widget.iri.value}>
        <FacetPropertyDataProvider value={propertyData}>
          <Widget
            shape={property}
            getConstraint={getConstraint}
            setConstraint={setConstraint}
            setConstraints={setConstraints}
            labelledBy={labelId}
          />
        </FacetPropertyDataProvider>
      </WidgetErrorBoundary>
    </FormElement>
  );
}
