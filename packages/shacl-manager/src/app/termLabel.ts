import type { Term } from "@rdfjs/types";
import {
  bestByLanguage,
  type BCP47,
  configuredLanguages,
  prefixedIri,
  termLabel as resolveTermLabel,
} from "@shapething/shacl-renderer";
import { createContext, use } from "react";
import { describeBlankNode } from "../data-model/blankNodes.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import type { Resource } from "../data-model/rdf.ts";

// The interface languages, most preferred first.
export const LanguagesContext = createContext<BCP47[]>([]);

// The renderer's own label resolution, so a node reads the same here as in a form. `fallback`
// only applies when that finds nothing, before the prefixed name or IRI.
export function termLabel(
  term: Resource,
  { store, prefixes }: DataModel,
  languages: BCP47[],
  fallback?: string,
): string {
  return (
    resolveTermLabel({ term, shapesGraph: store, languages }) ??
    fallback ??
    (term.termType === "BlankNode" ? "(blank node)" : (prefixedIri(term, prefixes) ?? term.value))
  );
}

export function useTermLabel(): (term: Resource, fallback?: string) => string {
  const dataModel = useDataModel();
  const languages = use(LanguagesContext);
  return (term, fallback) => termLabel(term, dataModel, languages, fallback);
}

// The best match among literals that aren't labels (e.g. sh:message), by the same languages.
export function useBestByLanguage(): (values: Term[]) => Term | undefined {
  const { store } = useDataModel();
  const languages = use(LanguagesContext);
  return (values) => bestByLanguage(values, configuredLanguages(store, languages));
}

// A tooltip: the full IRI, or a blank node's content.
export function termTitle(term: Resource, { store }: DataModel): string {
  return term.termType === "BlankNode" ? describeBlankNode(store, term) : term.value;
}
