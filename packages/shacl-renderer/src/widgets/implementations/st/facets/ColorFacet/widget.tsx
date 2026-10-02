import { useLocalization } from "@fluent/react";
import { factory } from "@/helpers/factory.ts";
import { st } from "@/helpers/namespaces.ts";
import { useFacetColorBuckets } from "@/outputs/render/modes/facet/facetData.tsx";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import { COLOR_BUCKET_ORDER, COLOR_BUCKET_SWATCH, type ColorBucket } from "@/helpers/colorBuckets.ts";
import "./style.css";

const BUCKET_LABEL_IDS: Record<ColorBucket, string> = {
  red: "color-bucket-red",
  orange: "color-bucket-orange",
  yellow: "color-bucket-yellow",
  green: "color-bucket-green",
  cyan: "color-bucket-cyan",
  blue: "color-bucket-blue",
  purple: "color-bucket-purple",
  pink: "color-bucket-pink",
  white: "color-bucket-white",
  gray: "color-bucket-gray",
  black: "color-bucket-black",
};

const BUCKET_LABEL_FALLBACKS: Record<ColorBucket, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  cyan: "Cyan",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  white: "White",
  gray: "Gray",
  black: "Black",
};

/**
 * This widget is bound to the same color property st:ColorEditor/st:ColorViewer use (opt-in, via
 * an explicit st:facet declaration - see score.ttl) - each value is a color node carrying its own
 * st:hue/st:saturation/st:lightness triples (genuine CSS HSL notation, see helpers/colorBuckets.ts's
 * Hsl type). Renders one clickable circle per non-empty named color bucket, colored with that
 * bucket's own canonical swatch rather than any one member's exact shade. Which buckets are
 * non-empty, and per-bucket counts, are classified by the facet source itself
 * (useFacetColorBuckets - the same sparqlFilterForBucket text picking a bucket filters by), so this
 * works the same against Environment.facetsEndpoint as against the local dataGraph.
 *
 * Clicking a bucket writes a single st:colorBucket value (the bucket's own name, e.g. "blue") - a
 * sibling sh:sparql SPARQLConstraint, built from helpers/colorBuckets.ts's sparqlFilterForBucket,
 * is kept in sync alongside it (see facets/filterShape.ts's syncColorBucketSparqlConstraint) so any
 * external SHACL-SPARQL-conformant engine can enforce the same rule without knowing st:colorBucket.
 *
 * Single-select: clicking one replaces any previous selection, and clicking the already-selected
 * bucket clears it. Per-bucket counts reflect every other facet's constraints, not this one's.
 */
export default function ColorFacet({ getConstraint, setConstraint, labelledBy }: FacetWidgetProps) {
  const { l10n } = useLocalization();
  const { available, counts } = useFacetColorBuckets();

  const buckets = COLOR_BUCKET_ORDER.filter((bucket) => available.includes(bucket));

  const selectedBucket = getConstraint(st("colorBucket"))[0]?.value as ColorBucket | undefined;

  const selectBucket = (bucket: ColorBucket) => {
    setConstraint(st("colorBucket"), bucket === selectedBucket ? undefined : factory.literal(bucket));
  };

  return (
    <div className="st-color-facet" role="radiogroup" aria-labelledby={labelledBy}>
      {buckets.map((bucket) => {
        const checked = bucket === selectedBucket;
        const label = l10n.getString(BUCKET_LABEL_IDS[bucket], undefined, BUCKET_LABEL_FALLBACKS[bucket]);
        const count = counts ? (counts.get(bucket) ?? 0) : undefined;

        return (
          <label key={bucket} className="st-color-facet__option" title={label}>
            <input
              type="radio"
              name={labelledBy}
              className="st-color-facet__checkbox"
              checked={checked}
              // A native radio only fires `change` when its own checked state actually flips, so
              // clicking the already-selected bucket (the deselect case) would never reach a plain
              // onChange handler. `click` fires unconditionally on every click regardless of
              // whether the browser's own checked state changes, so selectBucket's own
              // already-selected-vs-not branch is driven from there instead; onChange stays a
              // no-op purely to satisfy React's controlled-input contract for `checked`.
              onChange={() => {}}
              onClick={() => selectBucket(bucket)}
              aria-label={count !== undefined ? `${label} (${count})` : label}
            />
            <span
              className="st-color-facet__swatch"
              style={{ backgroundColor: COLOR_BUCKET_SWATCH[bucket] }}
              data-checked={checked}
              aria-hidden="true"
            />
            {count !== undefined && <span className="st-color-facet__count">{count}</span>}
          </label>
        );
      })}
    </div>
  );
}
