import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // An option is always one of sh:class's existing instances, so a fresh value is always an IRI,
  // regardless of what the shape declares.
  createTerm: () => factory.namedNode(""),
  // A field that can hold more than one value picks them all from the same options list (see
  // widget.tsx's isMultiValued), rather than rendering a fresh list per value.
  singleUnifiedWidget: (shape) => (shape.get(sh("maxCount")) ?? Infinity) !== 1,
} satisfies WidgetMeta;
