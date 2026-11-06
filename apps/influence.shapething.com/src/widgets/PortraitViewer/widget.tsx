import { defaultWidgets, type WidgetProps } from "@shapething/shacl-renderer";
import Avatar from "../../components/Avatar/Avatar.tsx";
import { inf, rdfs } from "../../rdf/namespaces.ts";

const ImageViewer = defaultWidgets.viewers.ImageViewer.Component;

/**
 * inf:PortraitViewer: the portrait of a person (wdt:P18), or their initials when Wikidata has no
 * portrait. The display shapes give wdt:P18 the sh:defaultValue inf:Initials, and Display turns on
 * enableDefaultValuesInViewMode, so a person without a portrait still gets this viewer, with the
 * marker as its value. The name comes from the person itself (rdfs:label), or else its identifier.
 */
export default function PortraitViewer(props: WidgetProps) {
  const { shape, term } = props;
  if (!term.equals(inf("Initials"))) return <ImageViewer {...props} />;

  const label = shape.dataGraph.getQuads(shape.focusNode, rdfs("label"))[0]?.object.value;
  const name = label ?? shape.focusNode.value.split("/").pop() ?? "";
  return <Avatar name={name} />;
}
