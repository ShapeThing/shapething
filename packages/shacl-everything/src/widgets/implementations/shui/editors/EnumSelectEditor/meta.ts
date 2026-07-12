import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // Whether an sh:in option is a NamedNode or a Literal is only known by inspecting its
  // actual members at runtime - sh:datatype/sh:nodeKind aren't required alongside sh:in.
  createTerm: (_context, shape) => {
    const options = shape.get(sh("in"));
    return options[0]?.termType === "NamedNode" ? factory.namedNode("") : factory.literal("");
  },
} satisfies WidgetMeta;
