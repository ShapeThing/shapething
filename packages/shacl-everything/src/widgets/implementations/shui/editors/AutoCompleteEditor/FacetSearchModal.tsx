import { useMemo, useState } from "react";
import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { rdf, sh } from "@/helpers/namespaces.ts";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import Teaser from "@/outputs/render/components/Teaser/index.tsx";
import ShaclRenderer from "@/outputs/render/render.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import type { SearchResult } from "@/outputs/render/hooks/query.ts";
import type { SubmitResult } from "@/environment.ts";
import { instancesMatchingOtherConstraints, type FilterShape } from "@/structure/filterShape.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";

type Props = {
  onClose: () => void;
  shape: PropertyUIElement;
  // The value node shape(s) to facet against (see resolution/label.ts's valueNodeShapes) - passed
  // through to the nested ShaclRenderer as its own `nodeShapes` allow-list (modes/facet/
  // NodeUIComponent.tsx), so only the shape(s) that actually describe this property's values are
  // offered, not every facetable root shape in the whole shapesGraph.
  nodeShapes: Quad_Subject[];
  // Every existing sh:class instance this property could possibly end up pointing at (already
  // deduped and stripped of values this property holds elsewhere) - the universe the facets below
  // narrow down, mirroring InstancesSelectEditor's own equivalent computation.
  candidateInstances: NamedNode[];
  onSelect: (result: SearchResult) => void;
};

/**
 * The modal AutoCompleteEditor's search icon opens instead of its own inline typeahead when
 * Environment.enableFacetSearchForAutocomplete is on and the property has a known value node shape
 * to facet against - a nested ShaclRenderer in facet mode (mode: "facet"), scoped to just that
 * shape via `nodeShapes`, so the user can narrow `candidateInstances` down through facets instead
 * of only a free-text search.
 *
 * Facet mode never renders a results list of its own (see FacetModeWrapper's own doc comment - it
 * only ever hands the generated filter shape to onSubmit), so this supplies one: every onSubmit
 * fire re-runs structure/filterShape.ts's own instancesMatchingOtherConstraints against that
 * filter shape - the same narrowing logic a facet's own live option count
 * (Environment.enableFacetOptionCounts) already uses internally - to turn "the constraints the
 * user set" back into "which candidates still qualify."
 */
export default function FacetSearchModal({
  onClose,
  shape,
  nodeShapes,
  candidateInstances,
  onSelect,
}: Props) {
  const outerEnvironment = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { activeLanguage: activeContentLanguage } = useContentLanguage();
  const fieldLabel = shape.label([activeInterfaceLanguage]);
  const [filterShape, setFilterShape] = useState<FilterShape>();

  const matchingInstances = useMemo(() => {
    if (!filterShape) return candidateInstances;
    return instancesMatchingOtherConstraints(
      filterShape,
      shape.dataGraph,
      shape.shapesGraph,
      candidateInstances,
      undefined,
    ) as NamedNode[];
  }, [filterShape, candidateInstances, shape.dataGraph]);

  const lookups = useOptionLookups(shape, matchingInstances);
  const lookupByIri = useMemo(
    () => new Map(lookups.map((result) => [result.iri.value, result])),
    [lookups],
  );

  return (
    <Modal
      open
      className="st-autocomplete__facet-search-modal"
      onClose={onClose}
      title={
        <Localized id="autocomplete-facet-search-title" vars={{ label: fieldLabel }}>
          {`Select a value for ${fieldLabel}`}
        </Localized>
      }
      size="large"
    >
      <div className="st-autocomplete__facet-search">
        <div className="st-autocomplete__facet-search-controls">
          {/* interfaceLanguage/contentLanguage only ever seed this nested renderer's own
              language state at mount (EnvironmentContextProvider/InterfaceLanguageProvider/
              ContentLanguageProvider all freeze their initial props), so a `key` on the active
              outer values forces a remount to pick up a later outer language switch. */}
          <ShaclRenderer
            key={`${activeInterfaceLanguage}::${activeContentLanguage}`}
            mode="facet"
            shapesGraph={shape.shapesGraph}
            dataGraph={shape.dataGraph}
            nodeShapes={nodeShapes}
            widgets={shape.widgetRegistry}
            interfaceLanguage={activeInterfaceLanguage}
            interfaceLocales={outerEnvironment.interfaceLocales}
            contentLanguage={activeContentLanguage}
            contentLanguages={outerEnvironment.contentLanguages}
            corsProxyUrl={outerEnvironment.corsProxyUrl}
            enableFacetTypeUnion={outerEnvironment.enableFacetTypeUnion}
            enableFacetOptionCounts={outerEnvironment.enableFacetOptionCounts}
            enableFacetTextSearchMerging={outerEnvironment.enableFacetTextSearchMerging}
            facetChangeMode={outerEnvironment.facetChangeMode}
            onSubmit={(result: SubmitResult) => {
              const rootNode = result.dataGraph.getQuads(null, rdf("type"), sh("NodeShape"))[0]
                ?.subject as NamedNode | undefined;
              if (rootNode) setFilterShape({ store: result.dataGraph, rootNode });
            }}
          />
        </div>
        <div className="st-autocomplete__facet-search-results" role="listbox">
          {matchingInstances.length === 0 ? (
            <div className="st-autocomplete__empty st-combo-empty">
              <Localized id="autocomplete-no-results">No results found</Localized>
            </div>
          ) : (
            matchingInstances.map((iri) => {
              const result = lookupByIri.get(iri.value) ?? { iri };
              return (
                <div
                  key={iri.value}
                  role="option"
                  aria-selected={false}
                  className="st-autocomplete__result"
                  onClick={() => onSelect(result)}
                >
                  <Teaser
                    term={result.iri}
                    label={result.label}
                    classification={result.classification}
                    depiction={result.depiction}
                    description={result.description}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
