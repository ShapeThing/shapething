import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // Plots every value of the property as one map, not one instance per value - mirrors
  // ValueTableViewer's own singleUnifiedWidget.
  singleUnifiedWidget: () => true,
} satisfies WidgetMeta;
