import type { Literal } from "@rdfjs/types";
import { rdf } from "@/helpers/namespaces.ts";

// A shui:DescriptionRole value as plain text for a snippet (e.g. a Teaser card): an rdf:HTML
// literal is flattened to its text content - rendering its markup there would mean either showing
// raw tags or injecting arbitrary HTML into a one-line summary. Every other literal (xsd:string,
// rdf:langString, rdf:dirLangString) is already plain text. Falls back to stripping tags with a
// regex where no DOMParser exists (e.g. a non-browser unit test).
export function descriptionText(literal: Literal): string {
  if (!literal.datatype.equals(rdf("HTML"))) return literal.value;
  const text =
    typeof DOMParser === "undefined"
      ? literal.value.replace(/<[^>]*>/g, " ")
      : (new DOMParser().parseFromString(literal.value, "text/html").body.textContent ?? "");
  return text.replace(/\s+/g, " ").trim();
}
