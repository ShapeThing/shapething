import type { WidgetMeta } from "@/widgets/types.ts";

// One shared dropzone (plus the list of already-uploaded files) for the whole property, not one
// dropzone per value - mirrors GeoEditor's own singleUnifiedWidget. shacl-renderer's own
// FileUploadEditor got the same one-widget-for-the-property effect via a (shacl-renderer-only)
// hidePlusButton meta flag; singleUnifiedWidget is this codebase's equivalent.
export default {
  singleUnifiedWidget: () => true,
} satisfies WidgetMeta;
