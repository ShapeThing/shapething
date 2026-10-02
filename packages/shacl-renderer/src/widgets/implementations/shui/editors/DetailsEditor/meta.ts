import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // This widget can be forced via shui:editor with no sh:nodeKind declared at all, so
  // IRI-vs-blank-node isn't always readable from the shape - default to a blank node, the
  // more common case for a nested detail value.
  createTerm: (_context, shape) => {
    const nodeKinds = shape.get(sh("nodeKind"));
    if (nodeKinds.length === 1 && nodeKinds[0].equals(sh("IRI"))) return factory.namedNode("");
    return factory.blankNode();
  },
} satisfies WidgetMeta;
