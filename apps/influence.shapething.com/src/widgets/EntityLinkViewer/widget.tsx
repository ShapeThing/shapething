import type { WidgetProps } from "@shapething/shacl-renderer";

/**
 * inf:EntityLinkViewer: a literal (the name of a country of citizenship) as a link to the resource
 * it belongs to, the focus node of the shape. A link to a Wikidata item opens that item in the
 * modal (see useLinkHandling), the way the shui:LabelViewer links of the occupations do.
 */
export default function EntityLinkViewer({ shape, term }: WidgetProps) {
  return (
    <a className="entity-link-viewer" href={shape.focusNode.value}>
      {term.value}
    </a>
  );
}
