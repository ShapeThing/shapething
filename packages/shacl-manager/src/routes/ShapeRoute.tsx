import { shapeRoute } from "@/router";
import type { NamedNode } from "@rdfjs/types";
import { ShaclRenderer } from "@shapething/shacl-everything";
import "@shapething/shacl-everything/style.css";
import { factory } from "@/helpers/factory.ts";
import { useDataModel } from "@/hooks/useDataModel";

const shapesShapesGraphUrl = new URL("../shapes/shape.ttl#shape", import.meta.url);
const shapesNodeShapes: NamedNode[] = [factory.namedNode(shapesShapesGraphUrl.href)];

export default function ShapeRoute() {
  const { shapeIri } = shapeRoute.useParams();
  const { corsProxyUrl } = shapeRoute.useRouteContext();
  const { store } = useDataModel();

  const decodedShapeIri = decodeURIComponent(shapeIri);

  return (
    <ShaclRenderer
      key={decodedShapeIri}
      shapesGraph={shapesShapesGraphUrl}
      dataGraph={store}
      interfaceLocales={{ "nl-NL": null }}
      focusNode={factory.namedNode(decodedShapeIri)}
      nodeShapes={shapesNodeShapes}
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
