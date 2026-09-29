import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // A new sh:property value is a property shape of its own - a blank node, like one written inline.
  createTerm: () => factory.blankNode(),
  // Renders once for the whole sh:property value set: the tree of every property (and the groups
  // holding them) is the widget, not one row per value.
  singleUnifiedWidget: () => true,
  // Each property row has its own remove button - the property-level "-" would clear them all.
  hideRemoveButton: true,
} satisfies WidgetMeta;
