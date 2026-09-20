import { useLocalization } from "@fluent/react";
import { useMemo } from "react";
import type { Quad_Subject, Term } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { st } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import { bucketForHsl, COLOR_BUCKET_ORDER, COLOR_BUCKET_SWATCH, type ColorBucket } from "@/helpers/colorBuckets.ts";
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
 * an explicit st:facet declaration - see score.ttl) - `values` are the color blank/named nodes
 * themselves, each carrying its own st:hue/st:saturation/st:lightness triples (genuine CSS HSL
 * notation, see helpers/colorBuckets.ts's Hsl type). Grouping them into a fixed set of named color
 * buckets (bucketForHsl) reads those triples directly off shape.dataGraph, no derived property or
 * hex parsing involved. Renders one clickable circle per non-empty bucket, colored with that
 * bucket's own canonical swatch rather than any one member's exact shade.
 *
 * Clicking a bucket writes a single st:colorBucket value (the bucket's own name, e.g. "blue") - a
 * sibling sh:sparql SPARQLConstraint, built from helpers/colorBuckets.ts's sparqlFilterForBucket,
 * is kept in sync alongside it (see structure/filterShape.ts's syncColorBucketSparqlConstraint).
 * That sh:sparql is what this renderer's own facet narrowing actually runs, via a real shacl-engine
 * validation pass (structure/filterShape.ts's instancesConformingViaEngine) - not a hand-rolled
 * reclassification of each candidate's own HSL values, though the *effect* is the same as if it
 * were. The same sh:sparql also lets any external SHACL-SPARQL-conformant engine enforce the exact
 * same rule without knowing st:colorBucket at all - the same "bespoke value plus a portable SPARQL
 * sibling" split MapFacet's own st:withinArea uses.
 *
 * Single-select: clicking one replaces any previous selection, and clicking the already-selected
 * bucket clears it. Per-bucket counts (valueCounts) still reflect every raw value in that bucket,
 * independent of which bucket (if any) is currently selected.
 */
export default function ColorFacet({
  shape,
  values,
  getConstraint,
  setConstraint,
  valueCounts,
  labelledBy,
}: FacetWidgetProps) {
  const { l10n } = useLocalization();

  const membersByBucket = useMemo(() => {
    const map = new Map<ColorBucket, Term[]>();
    for (const value of values) {
      if (value.termType !== "BlankNode" && value.termType !== "NamedNode") continue;
      const node = value as Quad_Subject;
      const hue = shape.dataGraph.getQuads(node, st("hue"))[0]?.object.value;
      const saturation = shape.dataGraph.getQuads(node, st("saturation"))[0]?.object.value;
      const lightness = shape.dataGraph.getQuads(node, st("lightness"))[0]?.object.value;
      if (hue === undefined || saturation === undefined || lightness === undefined) continue;

      const bucket = bucketForHsl({
        h: parseFloat(hue),
        s: parseFloat(saturation),
        l: parseFloat(lightness),
      });
      const members = map.get(bucket);
      if (members) members.push(value);
      else map.set(bucket, [value]);
    }
    return map;
  }, [shape.dataGraph, values]);

  const buckets = COLOR_BUCKET_ORDER.filter((bucket) => membersByBucket.has(bucket));

  const selectedBucket = getConstraint(st("colorBucket"))[0]?.value as ColorBucket | undefined;

  const selectBucket = (bucket: ColorBucket) => {
    setConstraint(st("colorBucket"), bucket === selectedBucket ? undefined : factory.literal(bucket));
  };

  return (
    <div className="st-color-facet" role="radiogroup" aria-labelledby={labelledBy}>
      {buckets.map((bucket) => {
        const members = membersByBucket.get(bucket)!;
        const checked = bucket === selectedBucket;
        const label = l10n.getString(BUCKET_LABEL_IDS[bucket], undefined, BUCKET_LABEL_FALLBACKS[bucket]);
        const count = valueCounts
          ? members.reduce((sum, member) => sum + (valueCounts.get(termKey(member)) ?? 0), 0)
          : undefined;

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
