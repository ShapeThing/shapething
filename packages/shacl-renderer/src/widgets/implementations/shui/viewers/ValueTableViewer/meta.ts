import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // Renders every value of the property as rows of one table - not one instance per value.
  singleUnifiedWidget: () => true,
} satisfies WidgetMeta;
