import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

// An Editor.js document is always a nested node holding its own ed:* subgraph (see
// outputData.ts) - same reasoning as AddressEditor/meta.ts: a fresh value always starts as a
// blank node regardless of what (if anything) the shape's own sh:nodeKind says. Mirrors
// shacl-renderer's own EditorJsEditor/meta.ts.
export default {
  createTerm: () => factory.blankNode(),
} satisfies WidgetMeta;
