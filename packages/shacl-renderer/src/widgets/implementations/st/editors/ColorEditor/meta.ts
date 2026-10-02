import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

// ColorEditor always edits a blank node's own fixed st:hue/st:saturation/st:lightness sub-fields
// (see widget.tsx) - defaultTermFromShape would only produce one if the shape's own sh:nodeKind
// explicitly allows BlankNode, so this guarantees a fresh value always starts as one regardless of
// what (if anything) the shape itself declares - mirrors AddressEditor/meta.ts.
export default {
  createTerm: () => factory.blankNode(),
} satisfies WidgetMeta;
