import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // Only reachable via an explicit shui:editor override, with no guarantee sh:nodeKind is
  // declared - this widget's whole purpose is editing a blank node, so it always creates one.
  createTerm: () => factory.blankNode(),
} satisfies WidgetMeta;
