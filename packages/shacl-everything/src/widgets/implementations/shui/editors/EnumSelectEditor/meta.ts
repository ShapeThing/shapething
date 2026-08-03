import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { WidgetMeta } from "@/widgets/types.ts";
import { selectQueryFor } from "./selectQuery.ts";

export default {
  // Whether an sh:in option is a NamedNode or a Literal is only known by inspecting its actual
  // members at runtime - sh:datatype/sh:nodeKind aren't required alongside sh:in. A sh:select-driven
  // sh:in only resolves its members once its query has run, so this defaults to NamedNode instead -
  // the common case for federated entity lookups (e.g. Wikidata IRIs).
  createTerm: (_context, shape) => {
    if (selectQueryFor(shape)) return factory.namedNode("");
    const options = shape.get(sh("in"));
    return options[0]?.termType === "NamedNode" ? factory.namedNode("") : factory.literal("");
  },
} satisfies WidgetMeta;
