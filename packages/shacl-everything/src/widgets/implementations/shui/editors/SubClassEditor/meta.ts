import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // shui:rootClass names the class hierarchy to browse, not the value's own node kind - a
  // subclass selection is always an IRI, regardless of what the shape declares.
  createTerm: () => factory.namedNode(""),
  // A field that can hold more than one class picks them all from the same tree - see
  // widget.tsx's multi-check mode - rather than opening a fresh tree per value.
  singleUnifiedWidget: (shape) => (shape.get(sh("maxCount")) ?? Infinity) !== 1,
} satisfies WidgetMeta;
