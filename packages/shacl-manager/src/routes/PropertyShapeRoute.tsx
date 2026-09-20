import { propertyShapeRoute } from "@/router";
import type { NamedNode } from "@rdfjs/types";
import { ShaclRenderer } from "@shapething/shacl-everything";
import "@shapething/shacl-everything/style.css";
import { factory } from "@/helpers/factory.ts";
import { useDataModel } from "@/hooks/useDataModel";

const shapesShapesGraphUrl = new URL("../shapes/shape.ttl#propertyShape", import.meta.url);
const shapesNodeShapes: NamedNode[] = [factory.namedNode(shapesShapesGraphUrl.href)];

export default function PropertyShapeRoute() {
  const { propertyShapeIri } = propertyShapeRoute.useParams();
  const { corsProxyUrl } = propertyShapeRoute.useRouteContext();
  const { store } = useDataModel();

  const decodedPropertyShapeIri = decodeURIComponent(propertyShapeIri);

  return (
    <ShaclRenderer
      key={decodedPropertyShapeIri}
      shapesGraph={shapesShapesGraphUrl}
      dataGraph={store}
      interfaceLocales={{ "nl-NL": null }}
      focusNode={factory.namedNode(decodedPropertyShapeIri)}
      nodeShapes={shapesNodeShapes}
      enableMissingShapesGeneration={true}
      enableWidgetSwitching={false}
      enableInterfaceLanguageWithShapesLabelsOnly={false}
      enableLogicalBranchSwitching={false}
      corsProxyUrl={corsProxyUrl}
      onSubmit={(result) => {
        console.log(result);
      }}
    />
  );
}
