import { classRoute } from "@/router";
import type { NamedNode } from "@rdfjs/types";
import { ShaclRenderer } from "@shapething/shacl-everything";
import "@shapething/shacl-everything/style.css";
import { factory } from "@/helpers/factory.ts";
import { useDataModel } from "@/hooks/useDataModel";

const shapesShapesGraphUrl = new URL("../shapes/shape.ttl#shape", import.meta.url);
const shapesNodeShapes: NamedNode[] = [factory.namedNode(shapesShapesGraphUrl.href)];

export default function ClassRoute() {
  const { classIri } = classRoute.useParams();
  const { corsProxyUrl } = classRoute.useRouteContext();
  const { store } = useDataModel();

  const decodedClassIri = decodeURIComponent(classIri);

  return (
    <ShaclRenderer
      key={decodedClassIri}
      shapesGraph={shapesShapesGraphUrl}
      dataGraph={store}
      interfaceLocales={{ "nl-NL": null }}
      focusNode={factory.namedNode(decodedClassIri)}
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
