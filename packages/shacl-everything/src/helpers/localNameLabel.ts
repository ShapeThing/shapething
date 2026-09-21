import type { Term } from "@rdfjs/types";
import { humanizeLocalName } from "@/helpers/humanizeLocalName.ts";
import { localName } from "@/helpers/localName.ts";

// localName(), humanized - the shared "display this term as a label, as a last resort" fallback.
// Only for a human-facing label: don't use this in place of localName() for a data-widget
// attribute, a generated code identifier, or any other place the raw, unsplit local name is
// itself the value being matched against (CSS selectors, story queries, SEVERITY_RANK keys, etc).
export function localNameLabel(term?: Term): string | null {
  const name = localName(term);
  return name !== null ? humanizeLocalName(name) : null;
}
