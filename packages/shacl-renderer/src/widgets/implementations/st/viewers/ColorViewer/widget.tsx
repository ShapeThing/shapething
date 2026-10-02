import type { Quad_Subject } from "@rdfjs/types";
import { hslToHex } from "@/helpers/colorBuckets.ts";
import { st } from "@/helpers/namespaces.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

/**
 * Read-only counterpart to ColorEditor: same "blank node carrying st:hue/st:saturation/
 * st:lightness, genuine CSS HSL notation" convention (see ColorEditor/widget.tsx and
 * helpers/colorBuckets.ts's Hsl type) - rendered as a swatch next to the hex text instead of an
 * editable input pair. Converts to hex only for display (helpers/colorBuckets.ts's hslToHex); the
 * swatch is omitted (hex text only) when `node` doesn't carry all three triples yet.
 */
export default function ColorViewer({ shape, term }: WidgetProps) {
  const node = term as Quad_Subject;

  const hex = useReactiveRead(shape.dataGraph, `color-viewer@${term.value}`, () => {
    const read = (predicate: ReturnType<typeof st>) =>
      shape.dataGraph.getQuads(node, predicate)[0]?.object.value;
    const h = read(st("hue"));
    const s = read(st("saturation"));
    const l = read(st("lightness"));
    if (h === undefined || s === undefined || l === undefined) return undefined;
    return hslToHex({ h: parseFloat(h), s: parseFloat(s), l: parseFloat(l) });
  });

  return (
    <span className="st-color-viewer">
      {hex && (
        <span
          className="st-color-viewer__swatch"
          style={{ backgroundColor: hex }}
          aria-hidden="true"
        />
      )}
      <span className="st-color-viewer__hex">{hex ?? ""}</span>
    </span>
  );
}
