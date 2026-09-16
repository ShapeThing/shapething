import { dereferenceUrl, resolveRdfSource } from "@/preprocess/resolveRdfSources.ts";

export {
  default as ShaclRenderer,
  type ShaclRendererProps,
} from "@/outputs/render/render.tsx";
export {
  default as ShaclUIApplication,
  type ShaclUIApplicationProps,
} from "@/outputs/application/ShaclUIApplication.tsx";
export {
  type FocusNodeAndNodeShapePair,
  type FocusNodeAndNodeShapeResolutionOptions,
  resolveFocusNodeAndNodeShapePairs,
} from "@/resolution/focusNodeAndNodeShapeResolution.ts";

export { dereferenceUrl, resolveRdfSource };
