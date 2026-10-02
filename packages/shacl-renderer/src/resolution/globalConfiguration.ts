import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { rdf, sh, shui } from "@/helpers/namespaces.ts";
import {
  parsePathNode,
  type PropertyPath,
} from "@/structure/paths/parsePropertyPath.ts";
import type { LanguageRange } from "@/types/BCP47.ts";

// 3.4 SHACL Global Configuration: the shui:Configuration-typed (or sh:Graph-typed - sh:Graph is
// stated to be a SHACL subclass of shui:Configuration, but this codebase does no OWL/RDFS reasoning
// elsewhere, so both types are checked explicitly) subject in `shapesGraph`. The spec doesn't define
// a tie-break for more than one such subject; first match wins, an edge case not worth more ceremony.
function configurationSubject(shapesGraph: RdfStore): Term | undefined {
  return (
    shapesGraph.getQuads(null, rdf("type"), shui("Configuration"))[0]
      ?.subject ??
      shapesGraph.getQuads(null, rdf("type"), sh("Graph"))[0]?.subject
  );
}

/**
 * shui:languagePreference (3.4): an ordered list of BCP47 tags, highest-priority first. A "" entry
 * means "no language" (8.1) and is kept as "" (not mapped to a sentinel) so bestByLanguage's own ""
 * handling can consume it directly. Returns [] when unconfigured.
 */
export function getLanguagePreference(shapesGraph: RdfStore): LanguageRange[] {
  const subject = configurationSubject(shapesGraph);
  const head = subject &&
    shapesGraph.getQuads(subject, shui("languagePreference"))[0]?.object;
  return head
    ? expandListOrTerm(head, shapesGraph).map((term) =>
      term.value as LanguageRange
    )
    : [];
}

/**
 * shui:labelPreference (3.4): an ordered list of SHACL Property Paths, highest-priority first -
 * parsed with parsePathNode(), the same predicate/sequence/alternative/inverse/.../path-expression
 * logic parsePropertyPath() uses for sh:path (list members here are path expressions themselves,
 * not property shapes wrapping one). Returns [] when unconfigured - callers apply their own
 * context-specific default (see resolution/label.ts's effectiveLabelPredicates).
 */
export function getLabelPreference(shapesGraph: RdfStore): PropertyPath[] {
  const subject = configurationSubject(shapesGraph);
  const head = subject &&
    shapesGraph.getQuads(subject, shui("labelPreference"))[0]?.object;
  return head
    ? expandListOrTerm(head, shapesGraph).map((term) =>
      parsePathNode(term, shapesGraph)
    )
    : [];
}

/**
 * shui:defaultNamespace (3.4): the namespace fresh user-added nodes are minted in (see
 * helpers/freshIri.ts). The value is a literal whose lexical form is an IRI, but an IRI node is
 * accepted too - only its string value is used. Returns undefined when unconfigured.
 */
export function getDefaultNamespace(shapesGraph: RdfStore): string | undefined {
  const subject = configurationSubject(shapesGraph);
  const value = subject &&
    shapesGraph.getQuads(subject, shui("defaultNamespace"))[0]?.object.value;
  return value || undefined;
}

/**
 * shui:timeZone (3.4): the IANA time zone new xsd:dateTime terms are constructed in (see
 * helpers/timeZone.ts). An identifier the platform's Intl doesn't recognize is ignored with a
 * warning rather than thrown, so a typo degrades to the unconfigured behavior instead of breaking
 * every date-time widget. Returns undefined when unconfigured.
 */
export function getTimeZone(shapesGraph: RdfStore): string | undefined {
  const subject = configurationSubject(shapesGraph);
  const value = subject &&
    shapesGraph.getQuads(subject, shui("timeZone"))[0]?.object.value;
  if (!value) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    console.warn(`shui:timeZone "${value}" is not a recognized time zone, ignoring it`);
    return undefined;
  }
}

/**
 * shui:readOnlyGraph (3.4): the named graphs whose triples can't be edited (e.g. inferred by a
 * reasoner). Returns [] when unconfigured - see preprocess/readOnlyGraphs.ts for how these feed
 * Environment.readOnlyGraph.
 */
export function getReadOnlyGraphs(shapesGraph: RdfStore): Term[] {
  const subject = configurationSubject(shapesGraph);
  const head = subject &&
    shapesGraph.getQuads(subject, shui("readOnlyGraph"))[0]?.object;
  return head
    ? expandListOrTerm(head, shapesGraph).filter((term) => term.termType === "NamedNode")
    : [];
}
