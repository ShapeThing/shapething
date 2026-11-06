import { Link, type WidgetProps } from "@shapething/shacl-renderer";
import { inf } from "../../rdf/namespaces.ts";

/**
 * inf:ExternalIdViewer: an external identifier as a link to the page it identifies, opened in a new
 * tab. The link is the property's formatter URL (Wikidata P1630, inf:formatterUrl on the property
 * shape, see data/resource.ts) with the identifier for its $1.
 */
export default function ExternalIdViewer({ shape, term }: WidgetProps) {
  const formatter = shape.get(inf("formatterUrl"), [])?.value;
  if (!formatter) return <span className="external-id-viewer">{term.value}</span>;
  const href = formatter.replace("$1", encodeURIComponent(term.value).replace(/%2F/g, "/"));
  return (
    <Link className="external-id-viewer" href={href} target="_blank" rel="noopener noreferrer">
      {term.value}
    </Link>
  );
}
