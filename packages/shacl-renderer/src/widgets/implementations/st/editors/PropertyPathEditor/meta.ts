import { factory } from "@/helpers/factory.ts";
import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  createTerm: () => factory.blankNode(),
} satisfies WidgetMeta;
