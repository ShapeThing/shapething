import { useCallback, useRef, useState, type FormEvent } from "react";
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
import { submitAttemptContext } from "@/outputs/render/contexts/submitAttemptContext.tsx";

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

  // Whether the <form> below has been submitted at least once - usePropertyValidationResults
  // withholds validation results until this is true, so e.g. an untouched sh:minCount-violating
  // field doesn't show as an error before the user has tried to submit, matching how most form
  // libraries gate validation display. Held as plain local state (not read via useContext here)
  // and provided through its own narrow context rather than folded into ValidationContextProvider,
  // so a background revalidation run doesn't force *this* component to re-render: EditModeWrapper
  // sits above NodeUIComponent, and PropertyUIElement instances are rebuilt fresh on every render
  // (see structure/childrenForShape.ts) - re-rendering from up here would hand useWidget's Suspense
  // queries fresh cache keys for every property, remounting widgets mid-edit and stealing focus.
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const markSubmitAttempted = useCallback(() => setHasAttemptedSubmit(true), []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Unlocks display of validation results already computed by ValidationContextProvider's live
    // validation - this doesn't block submission on invalid data, matching existing behavior below
    // (onSubmit still fires regardless of validity).
    markSubmitAttempted();
    const originalQuads = originalQuadsRef.current!;
    const finalQuads = dataGraph.getQuads();
    const { additions, deletions } = diffQuads(originalQuads, finalQuads);

    const store = RdfStore.createDefault();
    for (const quad of finalQuads) store.addQuad(quad);

    onSubmit?.({ dataGraph: store, additions, deletions });
  };

  return (
    <submitAttemptContext.Provider value={{ hasAttemptedSubmit, markSubmitAttempted }}>
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
    </submitAttemptContext.Provider>
  );
}
