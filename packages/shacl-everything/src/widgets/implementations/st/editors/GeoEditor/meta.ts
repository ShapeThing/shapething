import type { WidgetMeta } from "@/widgets/types.ts";

export default {
  // One shared map with its own drawing/editing toolbar for the whole property's geometries, not
  // one map per value - mirrors MapViewer's own singleUnifiedWidget.
  singleUnifiedWidget: () => true,
} satisfies WidgetMeta;
