import type { NamedNode } from "@rdfjs/types";
import { ShaclRenderer } from "@shapething/shacl-everything";
import "@shapething/shacl-everything/style.css";
import { factory } from "@/helpers/factory.ts";
import { useDataModel } from "@/hooks/useDataModel";

const ontologyShapesGraphUrl = new URL("../../shapes/ontology.ttl#shape", import.meta.url);
const ontologyNodeShapes: NamedNode[] = [factory.namedNode(ontologyShapesGraphUrl.href)];

type Props = {
  corsProxyUrl?: string;
};

export default function DatamodelMetadata({ corsProxyUrl }: Props) {
  const { dataModelIRI, store } = useDataModel();

  return (
    <ShaclRenderer
      shapesGraph={ontologyShapesGraphUrl}
      dataGraph={store}
      interfaceLocales={{ "nl-NL": null }}
      focusNode={dataModelIRI}
      nodeShapes={ontologyNodeShapes}
      enableWidgetSwitching={false}
      enableLogicalBranchSwitching={false}
      corsProxyUrl={corsProxyUrl}
      onSubmit={(result) => {
        console.log(result);
      }}
    />
  );
}
