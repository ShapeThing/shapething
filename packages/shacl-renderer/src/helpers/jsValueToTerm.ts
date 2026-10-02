import type { Literal, NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { rdf, xsd } from "@/helpers/namespaces.ts";

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * The write-side counterpart to termToJsValue.ts: formats a native JS value back to a literal of
 * `datatype`. A `language` tag is required exactly when `datatype` is rdf:langString - SHACL
 * shapes declare langString via sh:datatype the same as any other type, but RDF/JS models it as a
 * 2-arg `factory.literal(value, languageTag)` rather than a 2-arg `(value, datatypeTerm)` call
 * (see widgets/defaultTerm.ts's coerceTermToBranch for the same branch elsewhere in this codebase).
 */
export function jsValueToTerm(
  value: string | number | boolean | Date,
  datatype: NamedNode,
  language?: string,
): Literal {
  if (datatype.equals(rdf("langString"))) {
    return factory.literal(String(value), language ?? "");
  }

  if (value instanceof Date) {
    return factory.literal(formatDate(value, datatype), datatype);
  }

  return factory.literal(String(value), datatype);
}

// The exact inverse of termToJsValue.ts's parseDate: gYear/gYearMonth/gMonthDay/gDay were parsed
// by anchoring the components they don't carry at UTC 1970-01-01, so reading them back via the
// matching UTC getters recovers the original lexical form.
function formatDate(value: Date, datatype: NamedNode): string {
  if (datatype.equals(xsd("gYear"))) return String(value.getUTCFullYear());

  if (datatype.equals(xsd("gYearMonth"))) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}`;
  }

  if (datatype.equals(xsd("gMonthDay"))) {
    return `--${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }

  if (datatype.equals(xsd("gDay"))) return `---${pad(value.getUTCDate())}`;

  if (datatype.equals(xsd("date"))) return value.toISOString().slice(0, 10);

  return value.toISOString();
}
