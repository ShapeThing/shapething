import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

// AddressEditor always edits a nested blank node's own fixed schema:* sub-fields (see widget.tsx)
// - defaultTermFromShape would only produce one if the shape's own sh:nodeKind explicitly allows
// BlankNode, so this guarantees a fresh value always starts as one regardless of what (if
// anything) the shape itself declares - mirrors shacl-renderer's own AddressEditor/meta.ts.
export default {
  createTerm: () => factory.blankNode(),
} satisfies WidgetMeta;
