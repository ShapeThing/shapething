// Load-bearing order: render.tsx must be the first module this entry evaluates. The source has an
// import cycle (preprocess/resolveRdfSources.ts -> ... -> the render tree -> preprocess/index.ts ->
// resolveRdfSources.ts), and preprocess/index.ts reads resolveRdfSources at module-evaluation time
// (its defaultPreprocessors array). Entering the cycle through resolveRdfSources.ts first - as
// importing it at the top here used to - evaluates preprocess/index.ts before resolveRdfSources is
// initialized, and the built dist throws "Cannot access 'resolveRdfSources' before
// initialization" on import. Entering through render.tsx evaluates resolveRdfSources.ts fully first.
export {
  default as ShaclRenderer,
  type ShaclRendererProps,
} from "@/outputs/render/render.tsx";
import { dereferenceUrl, resolveRdfSource } from "@/preprocess/resolveRdfSources.ts";
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

// Public types/values an embedder needs to configure ShaclRenderer, type an onSubmit handler, or
// write their own preprocessor / custom widget.
export {
  type Environment,
  type RawEnvironment,
  type SubmitResult,
  defaultEnvironment,
  minimalEnvironment,
} from "@/environment.ts";
export { type Preprocessor, defaultPreprocessors } from "@/preprocess/index.ts";
export type { RdfSource } from "@/types/RdfSource.ts";
export type { BCP47, LanguageRange } from "@/types/BCP47.ts";
export type { Severity } from "@/types/severity.ts";
export {
  DEFAULT_LOCALE,
  type LocaleLoader,
  type LocaleLoaderOverrides,
} from "@/l10n/locales.ts";
// The widget SDK: widget contract types, the bundled registry, structure elements and the hooks
// bundled widgets are built on - see widgetSdk.ts.
export * from "@/widgetSdk.ts";
// A value export here (widgetSdk.ts only re-exports its type) - group widgets receive one.
export { GroupUIElement } from "@/structure/GroupUIElement.ts";
