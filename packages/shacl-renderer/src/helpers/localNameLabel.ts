import type { Term } from "@rdfjs/types";
import { humanizeLocalName } from "@/helpers/humanizeLocalName.ts";
import { localName } from "@/helpers/localName.ts";

// localName(), humanized - the shared "display this term as a label, as a last resort" fallback.
// Only for a human-facing label: don't use this in place of localName() for a data-widget
// attribute, a generated code identifier, or any other place the raw, unsplit local name is
// itself the value being matched against (CSS selectors, story queries, SEVERITY_RANK keys, etc).
//
// A namespace IRI itself (e.g. `http://www.w3.org/2004/02/skos/core#`, written `skos:`) has an
// empty local name - null rather than "", so callers' `?? term.value` fallback still kicks in
// instead of rendering a blank label.
export function localNameLabel(term?: Term): string | null {
  const name = localName(term);
  return name ? humanizeLocalName(name) : null;
}
