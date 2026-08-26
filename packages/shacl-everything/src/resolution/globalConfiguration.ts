import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { rdf, sh, shui } from "@/helpers/namespaces.ts";
import { parsePathNode, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import type { LanguageRange } from "@/types/BCP47.ts";

// 3.4 SHACL Global Configuration: the shui:Configuration-typed (or sh:Graph-typed - sh:Graph is
// stated to be a SHACL subclass of shui:Configuration, but this codebase does no OWL/RDFS reasoning
// elsewhere, so both types are checked explicitly) subject in `shapesGraph`. The spec doesn't define
// a tie-break for more than one such subject; first match wins, an edge case not worth more ceremony.
function configurationSubject(shapesGraph: RdfStore): Term | undefined {
  return (
    shapesGraph.getQuads(null, rdf("type"), shui("Configuration"))[0]?.subject ??
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
  const head = subject && shapesGraph.getQuads(subject, shui("languagePreference"))[0]?.object;
  return head ? expandListOrTerm(head, shapesGraph).map((term) => term.value as LanguageRange) : [];
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
  const head = subject && shapesGraph.getQuads(subject, shui("labelPreference"))[0]?.object;
  return head
    ? expandListOrTerm(head, shapesGraph).map((term) => parsePathNode(term, shapesGraph))
    : [];
}
