import { useRef, type FormEvent } from "react";
import { Localized } from "@fluent/react";
import type { Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { diffQuads } from "@/helpers/diffQuads.ts";
import NodeUIComponent from "@/outputs/render/modes/edit/NodeUIComponent.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import ContentLanguageSwitcher from "@/outputs/render/components/ContentLanguageSwitcher/index.tsx";
import InterfaceLanguageSwitcher from "@/outputs/render/components/InterfaceLanguageSwitcher/index.tsx";
import ValidationContextProvider from "@/outputs/render/contexts/ValidationContextProvider.tsx";

type Props = {
  children?: React.ReactNode;
};

export default function EditModeWrapper({ children }: Props) {
  const { focusNode, dataGraph, onSubmit } = useEnvironment();
  const hasTriples = useReactiveRead(
    dataGraph,
    focusNode.value,
    () => dataGraph.getQuads(focusNode, null, null).length > 0,
  );

  // dataGraph's identity is stable for the life of this edit session (EnvironmentContextProvider
  // builds the Environment once and never rebuilds it), so this lazy initializer only ever runs on
  // this component's very first render - before any widget has had a chance to mutate dataGraph.
  const originalQuadsRef = useRef<Quad[] | null>(null);
  originalQuadsRef.current ??= dataGraph.getQuads();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const originalQuads = originalQuadsRef.current!;
    const finalQuads = dataGraph.getQuads();
    const { additions, deletions } = diffQuads(originalQuads, finalQuads);

    const store = RdfStore.createDefault();
    for (const quad of finalQuads) store.addQuad(quad);

    onSubmit?.({ dataGraph: store, additions, deletions });
  };

  return (
    <ValidationContextProvider>
      <form onSubmit={handleSubmit} className="st-edit-mode">
        <header className="st-header">
          <InterfaceLanguageSwitcher />
          <ContentLanguageSwitcher />
        </header>

        <NodeUIComponent />
        {children}
        <div className="st-edit-mode--actions">
          <button className="st-button st-button--primary" type="submit">
            {hasTriples ? (
              <Localized id="node-ui-submit-update">Update</Localized>
            ) : (
              <Localized id="node-ui-submit-create">Create</Localized>
            )}
          </button>
        </div>
      </form>
    </ValidationContextProvider>
  );
}
