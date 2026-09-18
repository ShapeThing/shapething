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
// groupLabel is spec'd for sh:PropertyGroup nodes, but its lookup (rdfs:label, then sh:name,
// best-matching language, no data-graph/local-name fallback of its own) makes no PropertyGroup-
// specific assumption - it's the one label-resolution export usable on a bare term with no
// enclosing PropertyUIElement (unlike propertyLabel/valueNodeLabel/ontologyLabel, which all
// require one for graph/language context), so it doubles as a plain "this term's own shape-graph
// label" lookup for a caller with just a term + a store. Paired with localName for the final
// fallback groupLabel deliberately omits.
export { groupLabel } from "@/resolution/label.ts";
export { localName } from "@/helpers/localName.ts";

export { dereferenceUrl, resolveRdfSource };
