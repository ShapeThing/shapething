import { Link, type WidgetProps } from "@shapething/shacl-renderer";

/**
 * inf:EntityLinkViewer: a literal (the name of a work, an idea or an interest) as a link to the resource
 * it belongs to, the focus node of the shape. A link to a Wikidata item opens that item in the
 * modal (see Display), the way the shui:LabelViewer links of the occupations do.
 */
export default function EntityLinkViewer({ shape, term }: WidgetProps) {
  return (
    <Link className="entity-link-viewer" href={shape.focusNode.value}>
      {term.value}
    </Link>
  );
}
