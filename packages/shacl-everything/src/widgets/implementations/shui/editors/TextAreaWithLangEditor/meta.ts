import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // rdf:langString needs an actual language tag, not just a datatype - and the active
  // content language is a runtime setting, not something the property shape declares.
  createTerm: ({ contentLanguage }) => factory.literal("", contentLanguage),
} satisfies WidgetMeta;
