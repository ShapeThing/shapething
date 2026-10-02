import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // sh:datatype's value is always a NamedNode (a datatype IRI) - never a Literal/BlankNode, unlike
  // EnumSelectEditor's sh:in-driven guess.
  createTerm: () => factory.namedNode(""),
} satisfies WidgetMeta;
