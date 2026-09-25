import r2wc from "@r2wc/react-to-web-component";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import type { Environment, SubmitResult } from "@/environment.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import type { RdfSource } from "@/types/RdfSource.ts";
import { factory } from "@/helpers/factory.ts";

// Every attribute-settable prop, camelCased (r2wc maps each to its kebab-case attribute, e.g.
// focusNode <-> focus-node). Anything that can't be expressed as an attribute (an RdfStore, a
// Preprocessor array, a widget set, a locale loader) goes through the `environment` JS property
// instead - see ShaclRendererElement below.
const webComponentProps = {
  mode: "string",
  // A URL (resolved against document.baseURI, so relative paths work) or inline RDF text - see
  // toRdfSource.
  shapes: "string",
  data: "string",
  readOnlyData: "string",
  focusNode: "string",
  // Whitespace-separated IRIs.
  nodeShapes: "string",
  interfaceLanguage: "string",
  contentLanguage: "string",
  // Whitespace-separated BCP47 tags.
  contentLanguages: "string",
  languageMode: "string",
  viewModeLabelLayout: "string",
  facetChangeMode: "string",
  corsProxyUrl: "string",
  mapStyleUrl: "string",
  facetsEndpoint: "string",
  // r2wc's boolean transform only parses an attribute with a value ("true"/"false", "1"/"0") - a
  // bare `enable-edit-in-place` attribute with no value is ignored, same as in shacl-renderer.
  enableWidgetSwitching: "boolean",
  enableLogicalBranchSwitching: "boolean",
  enableAlternativePathSwitching: "boolean",
  enableContentLanguageCreation: "boolean",
  enableShPathInLabelTitle: "boolean",
  enableFullLanguageRemoval: "boolean",
  enableInterfaceLanguageWithShapesLabelsOnly: "boolean",
  enableEditInPlace: "boolean",
  enableViewInPlace: "boolean",
  enableCreateInPlace: "boolean",
  enableLinksToResources: "boolean",
  enableUndoRedo: "boolean",
  enableFacetTypeUnion: "boolean",
  enableFacetOptionCounts: "boolean",
  enableMissingShapesGeneration: "boolean",
  enableMissingPropertyNameDereferencing: "boolean",
  enableFacetTextSearchMerging: "boolean",
  enableFacetSearchForAutocomplete: "boolean",
} as const;

type AttributeProps = {
  [K in keyof typeof webComponentProps]?: (typeof webComponentProps)[K] extends "boolean"
    ? boolean
    : string;
};

type WrapperProps = AttributeProps & {
  // The element itself (r2wc passes it in, since there's no shadow root).
  container?: HTMLElement;
  // Set through the element's `environment` property, never an attribute.
  environment?: ShaclRendererProps;
};

export const SUBMIT_EVENT = "shacl-submit";

// A string without any whitespace is taken to be a (possibly relative) URL; anything else is RDF
// text - no Turtle/N-Triples/JSON-LD document worth rendering fits on one whitespace-free token.
const toRdfSource = (value: string | undefined): RdfSource | undefined => {
  if (!value?.trim()) return undefined;
  return /\s/.test(value.trim()) ? value : new URL(value.trim(), document.baseURI);
};

const splitList = (value: string | undefined) => value?.trim().split(/\s+/).filter(Boolean);

// EnvironmentContextProvider builds its Environment once per mount and deliberately ignores later
// prop changes (see its own doc comment), so a changed attribute/property only takes effect by
// remounting. Objects can't be serialized into the key, so they're keyed by identity instead.
const objectIds = new WeakMap<object, number>();
let nextObjectId = 0;
const remountKey = (props: WrapperProps) =>
  JSON.stringify(props, (key, value) => {
    if (key === "container" || typeof value === "function") return undefined;
    if (key === "environment" && value) {
      if (!objectIds.has(value)) objectIds.set(value, nextObjectId++);
      return objectIds.get(value);
    }
    return value;
  });

function Wrapper(props: WrapperProps) {
  const { environment, container, ...attributes } = props;
  // Not r2wc's own `events` option: that would name it `submit`, which collides with edit mode's
  // inner <form>'s native (detail-less) submit event bubbling up through the same element.
  const onSubmit = (result: SubmitResult) =>
    container?.dispatchEvent(new CustomEvent(SUBMIT_EVENT, { detail: result, bubbles: true }));
  const fromAttributes: ShaclRendererProps = {
    mode: attributes.mode as Environment["mode"] | undefined,
    shapesGraph: toRdfSource(attributes.shapes),
    dataGraph: toRdfSource(attributes.data),
    readOnlyGraph: toRdfSource(attributes.readOnlyData),
    focusNode: attributes.focusNode ? factory.namedNode(attributes.focusNode) : undefined,
    nodeShapes: splitList(attributes.nodeShapes)?.map((iri) => factory.namedNode(iri)),
    interfaceLanguage: attributes.interfaceLanguage as BCP47 | undefined,
    contentLanguage: attributes.contentLanguage as BCP47 | undefined,
    contentLanguages: splitList(attributes.contentLanguages) as BCP47[] | undefined,
    languageMode: attributes.languageMode as Environment["languageMode"] | undefined,
    viewModeLabelLayout: attributes.viewModeLabelLayout as
      | Environment["viewModeLabelLayout"]
      | undefined,
    facetChangeMode: attributes.facetChangeMode as Environment["facetChangeMode"],
    corsProxyUrl: attributes.corsProxyUrl,
    mapStyleUrl: attributes.mapStyleUrl,
    facetsEndpoint: attributes.facetsEndpoint,
    enableWidgetSwitching: attributes.enableWidgetSwitching,
    enableLogicalBranchSwitching: attributes.enableLogicalBranchSwitching,
    enableAlternativePathSwitching: attributes.enableAlternativePathSwitching,
    enableContentLanguageCreation: attributes.enableContentLanguageCreation,
    enableShPathInLabelTitle: attributes.enableShPathInLabelTitle,
    enableFullLanguageRemoval: attributes.enableFullLanguageRemoval,
    enableInterfaceLanguageWithShapesLabelsOnly:
      attributes.enableInterfaceLanguageWithShapesLabelsOnly,
    enableEditInPlace: attributes.enableEditInPlace,
    enableViewInPlace: attributes.enableViewInPlace,
    enableCreateInPlace: attributes.enableCreateInPlace,
    enableLinksToResources: attributes.enableLinksToResources,
    enableUndoRedo: attributes.enableUndoRedo,
    enableFacetTypeUnion: attributes.enableFacetTypeUnion,
    enableFacetOptionCounts: attributes.enableFacetOptionCounts,
    enableMissingShapesGeneration: attributes.enableMissingShapesGeneration,
    enableMissingPropertyNameDereferencing: attributes.enableMissingPropertyNameDereferencing,
    enableFacetTextSearchMerging: attributes.enableFacetTextSearchMerging,
    enableFacetSearchForAutocomplete: attributes.enableFacetSearchForAutocomplete,
    onSubmit,
  };

  // EnvironmentContextProvider spreads these over defaultEnvironment, so an unset attribute must be
  // left out entirely rather than passed as `undefined` (which would clobber the default).
  const definedAttributes = Object.fromEntries(
    Object.entries(fromAttributes).filter(([, value]) => value !== undefined),
  ) as ShaclRendererProps;

  return <ShaclRenderer key={remountKey(props)} {...definedAttributes} {...environment} />;
}

const R2wcShaclRenderer = r2wc(Wrapper, { props: webComponentProps });

// r2wc's own element internals (the current props bag and its re-render trigger), shared via
// Symbol.for so this subclass can add a JS-only property alongside the attribute-backed ones.
const r2wcProps = Symbol.for("r2wc.props");
const r2wcRender = Symbol.for("r2wc.render");

type R2wcInternals = {
  [r2wcProps]: WrapperProps;
  [r2wcRender]: () => void;
};

/**
 * `<shacl-renderer>`: every attribute listed in webComponentProps, plus an `environment` property
 * for anything an attribute can't carry (pre-parsed RdfStores, preprocessors, custom widgets,
 * interface locale loaders, ...). `environment` wins over attributes on overlap. Submitting (edit
 * mode) or changing facets (facet mode) dispatches a `shacl-submit` CustomEvent with the SubmitResult as
 * its `detail`. Renders into light DOM, so the library stylesheet must be loaded on the page.
 */
export class ShaclRendererElement extends R2wcShaclRenderer {
  get environment(): ShaclRendererProps | undefined {
    return (this as unknown as R2wcInternals)[r2wcProps].environment;
  }

  set environment(value: ShaclRendererProps | undefined) {
    const internals = this as unknown as R2wcInternals;
    internals[r2wcProps].environment = value;
    internals[r2wcRender]();
  }
}

export const defineShaclRenderer = (tagName = "shacl-renderer") => {
  if (!customElements.get(tagName)) customElements.define(tagName, ShaclRendererElement);
};

defineShaclRenderer();

declare global {
  interface HTMLElementTagNameMap {
    "shacl-renderer": ShaclRendererElement;
  }
  interface HTMLElementEventMap {
    "shacl-submit": CustomEvent<SubmitResult>;
  }
}
