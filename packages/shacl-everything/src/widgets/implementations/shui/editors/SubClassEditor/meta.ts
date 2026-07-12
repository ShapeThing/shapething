import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // shui:rootClass names the class hierarchy to browse, not the value's own node kind - a
  // subclass selection is always an IRI, regardless of what the shape declares.
  createTerm: () => factory.namedNode(""),
} satisfies WidgetMeta;
