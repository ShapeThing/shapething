import { useEffect, useState } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { hexToHsl, hslToHex } from "@/helpers/colorBuckets.ts";
import { factory } from "@/helpers/factory.ts";
import { st, xsd } from "@/helpers/namespaces.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
// <input type="color"> only ever accepts a full 6-digit hex value - shown while the committed/
// in-progress text doesn't parse as one yet (e.g. still empty, or mid-edit), never written back.
const FALLBACK_SWATCH_COLOR = "#000000";

// "" (rendered as the fallback swatch/an empty text field) when `node` doesn't carry all three
// triples yet - a freshly-minted, still-untouched blank node (see meta.ts's own createTerm), not
// an error.
function readHex(shape: WidgetProps["shape"], node: Quad_Subject): string {
  const read = (predicate: ReturnType<typeof st>) =>
    shape.dataGraph.getQuads(node, predicate)[0]?.object.value;
  const h = read(st("hue"));
  const s = read(st("saturation"));
  const l = read(st("lightness"));
  if (h === undefined || s === undefined || l === undefined) return "";
  return hslToHex({ h: parseFloat(h), s: parseFloat(s), l: parseFloat(l) });
}

/**
 * A value here is a blank node carrying three plain xsd:decimal sibling triples - st:hue/
 * st:saturation/st:lightness, genuine CSS HSL notation (see helpers/colorBuckets.ts's Hsl type) -
 * rather than a hex string typed with a borrowed-datatype sentinel. Same idiom as AddressEditor:
 * a widget that owns a fixed set of sub-fields on a compound blank node, opt-in only via an
 * explicit shui:editor declaration (see score.ttl) since there's no reliable auto-detection signal
 * for "this nested object is specifically a color" the way there is for a plain literal's own
 * sh:datatype.
 *
 * The swatch and hex text field both still speak hex - that stays the most familiar way to pick an
 * exact color - converting to/from HSL only at read/write time (helpers/colorBuckets.ts's
 * hexToHsl/hslToHex); hex itself is never stored. st:ColorFacet reads st:hue directly off the same
 * kind of blank node elsewhere in the graph for its own bucket-range facet (see its own widget.tsx)
 * - unaffected by anything this widget does beyond keeping these three triples correct.
 */
export default function ColorEditor({ shape, term, setTerm, labelledBy, autoFocus }: WidgetProps) {
  const node = term as Quad_Subject;
  const storedHex = useReactiveRead(shape.dataGraph, `color-editor@${term.value}`, () =>
    readHex(shape, node),
  );

  // storedHex only changes as a result of an actual committed write (this widget's own commit()
  // below, or an external one - undo/redo, another widget touching the same node) - typing alone
  // never touches shape.dataGraph, so this can never clobber an in-progress edit mid-keystroke
  // (same reasoning as useDeferredInput's own sync effect).
  const [localValue, setLocalValue] = useState(storedHex);
  useEffect(() => {
    setLocalValue(storedHex);
  }, [storedHex]);

  const ref = useAutoFocusRef<HTMLInputElement>(autoFocus);
  const swatchValue = HEX_COLOR_PATTERN.test(localValue) ? localValue : FALLBACK_SWATCH_COLOR;

  // Writes `hex`'s HSL components onto `node`, replacing any existing st:hue/st:saturation/
  // st:lightness triples, and re-affirms `term` as this property's own value in the same
  // transaction - a blank node's identity never changes across edits, but a freshly-minted one
  // (meta.ts's createTerm) isn't actually linked into the graph until setTerm is called at least
  // once (mirrors AddressEditor/widget.tsx's own apply() and its doc comment on why). A hex that
  // fails to parse is silently ignored rather than writing a partial/invalid triple set.
  const commit = (hex: string) => {
    const hsl = hexToHsl(hex);
    if (!hsl) return;

    transact(shape.dataGraph, () => {
      for (const predicate of [st("hue"), st("saturation"), st("lightness")]) {
        for (const quad of shape.dataGraph.getQuads(node, predicate)) shape.dataGraph.removeQuad(quad);
      }
      shape.dataGraph.addQuad(factory.quad(node, st("hue"), factory.literal(String(hsl.h), xsd("decimal"))));
      shape.dataGraph.addQuad(
        factory.quad(node, st("saturation"), factory.literal(String(hsl.s), xsd("decimal"))),
      );
      shape.dataGraph.addQuad(
        factory.quad(node, st("lightness"), factory.literal(String(hsl.l), xsd("decimal"))),
      );
      setTerm(term);
    });
  };

  return (
    <span className="st-color-editor">
      <input
        type="color"
        className="st-color-editor__swatch"
        value={swatchValue}
        onChange={(event) => {
          setLocalValue(event.target.value);
          commit(event.target.value);
        }}
        aria-labelledby={labelledBy}
      />
      <input
        ref={ref}
        type="text"
        className="st-input st-color-editor__hex"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onBlur={() => {
          if (localValue !== storedHex) commit(localValue);
        }}
        placeholder="#000000"
        pattern={HEX_COLOR_PATTERN.source}
        aria-labelledby={labelledBy}
      />
    </span>
  );
}
