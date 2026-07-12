import { factory } from "@/helpers/factory.ts";
import { xsd } from "@/helpers/namespaces.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // Unlike a string, an empty literal isn't a valid xsd:boolean lexical value - the shape
  // gives us the datatype but not a sensible starting value, so this widget picks one.
  createTerm: () => factory.literal("false", xsd("boolean")),
} satisfies WidgetMeta;
