import type { BlankNode, NamedNode } from "@rdfjs/types";
import { ShaclRenderer } from "@shapething/shacl-renderer";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useDataModel } from "@/data-model/useDataModel.ts";
import { factory } from "@/helpers/factory.ts";

type Props = {
  /** A form shape inside one of the domain forms/*.ttl files, e.g. new URL("./forms/x.ttl#y"). */
  form: URL;
  /** A blank node works too, e.g. a property shape declared inline as `sh:property [ ... ]`. */
  focusNode: NamedNode | BlankNode;
};

/**
 * Edits one resource of the data model with ShaclRenderer. Imported triples render read-only
 * (readOnlyGraph); a submit is written into the main graph and every domain query refreshes.
 */
export default function ResourceForm({ form, focusNode }: Props) {
  const { store, readOnlyGraph, applyChanges, dataModelIRI, isEditable } = useDataModel();
  // Something only an import describes can't be edited here at all, so it gets the view mode.
  const mode = isEditable(focusNode) ? "edit" : "view";
  const queryClient = useQueryClient();
  const { corsProxyUrl } = useRouter().options.context;

  const shapesGraph = new URL(form.href.split("#")[0]);

  return (
    <ShaclRenderer
      key={`${form.href} ${focusNode.value} ${mode}`}
      shapesGraph={shapesGraph}
      dataGraph={store}
      mode={mode}
      readOnlyGraph={readOnlyGraph}
      focusNode={focusNode}
      nodeShapes={[factory.namedNode(form.href)]}
      // English only for now, for the interface and the content alike: with one language of
      // each, the renderer shows neither language switcher. Data is tagged @en, not @en-GB.
      interfaceLanguage="en-GB"
      interfaceLocales={{ "nl-NL": null }}
      contentLanguage="en"
      contentLanguages={["en"]}
      enableContentLanguageCreation={false}
      enableWidgetSwitching={false}
      enableInterfaceLanguageWithShapesLabelsOnly={false}
      enableLogicalBranchSwitching={false}
      corsProxyUrl={corsProxyUrl}
      onSubmit={(result) => {
        applyChanges(result);
        void queryClient.invalidateQueries({
          queryKey: ["shacl-manager-select", dataModelIRI.value],
        });
      }}
    />
  );
}
