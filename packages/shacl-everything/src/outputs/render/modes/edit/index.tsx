import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Localized } from "@fluent/react";
import type { Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { diffQuads } from "@/helpers/diffQuads.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { getHistory, transact } from "@/helpers/reactiveRdfStore.ts";
import NodeUIComponent from "@/outputs/render/modes/edit/NodeUIComponent.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { orphanedTargetWhereObjects, shapesWhereTargetingFocusNode } from "@/resolution/targets.ts";
import { removePropertyPath } from "@/structure/paths/removePropertyPath.ts";
import ContentLanguageSwitcher from "@/outputs/render/components/ContentLanguageSwitcher/index.tsx";
import InterfaceLanguageSwitcher from "@/outputs/render/components/InterfaceLanguageSwitcher/index.tsx";
import ValidationContextProvider from "@/outputs/render/contexts/ValidationContextProvider.tsx";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import { submitAttemptContext } from "@/outputs/render/contexts/submitAttemptContext.tsx";
import {
  undoRedoScopeContext,
  type UndoRedoScope,
} from "@/outputs/render/contexts/undoRedoScopeContext.tsx";
import { worstSeverity } from "@/helpers/worstSeverity.ts";

type Props = {
  children?: React.ReactNode;
};

// True for an element the browser already gives its own text-undo (a text input/textarea, or a
// contentEditable like RichTextEditor) - Ctrl+Z/Ctrl+Y there is left alone (see the keydown
// listener below) rather than fighting that native undo for an in-progress, not-yet-committed edit.
function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

export default function EditModeWrapper({ children }: Props) {
  const { focusNode, shapesGraph, dataGraph, nodeShapes, readOnlyGraph, onSubmit, enableUndoRedo } =
    useEnvironment();
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

  // Latest live-validation results (see ValidationContextProvider), written on every revalidation
  // without ever causing *this* component to re-render - handleSubmit reads it imperatively at
  // submit time instead, same reasoning as hasAttemptedSubmit living in its own context: this
  // component sits above NodeUIComponent, and re-rendering from up here on every keystroke would
  // remount widgets mid-edit (see submitAttemptContext's own comment).
  const latestValidationResultsRef = useRef<ValidationResult[]>([]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Unlocks display of validation results already computed by ValidationContextProvider's live
    // validation, so an sh:minCount-violating field now shows its error.
    markSubmitAttempted();
    // sh:Warning/sh:Info don't affect SHACL conformance - only an sh:Violation blocks submission,
    // same rule shacl-engine itself uses for report.conforms.
    if (worstSeverity(latestValidationResultsRef.current) === "Violation") return;

    // A sh:targetWhere fragment (see NodeUIComponent's own effectiveNodeShapes) that no longer
    // matches has already stopped rendering its fields - but nothing else prunes the triples those
    // fields used to hold, so they'd otherwise resubmit unchanged. Delete them now, for real,
    // before taking the diff snapshot below, so diffQuads picks the deletion up for free.
    const activeFragments = await shapesWhereTargetingFocusNode(focusNode, shapesGraph, dataGraph);
    const effectiveNodeShapes = dedupeTerms([...nodeShapes, ...activeFragments]);
    const orphaned = await orphanedTargetWhereObjects(
      focusNode,
      shapesGraph,
      dataGraph,
      effectiveNodeShapes,
      readOnlyGraph,
    );
    transact(dataGraph, () => {
      for (const entry of orphaned) {
        if (entry.kind === "memberShapeList") {
          // Retires the whole rdf:first/rdf:rest cell chain, not just the link to its head - see
          // orphanedTargetWhereObjects's own doc comment for why a memberShape property needs this
          // instead of a plain removePropertyPath.
          rebuildRdfList(entry.head, [], dataGraph);
          removePropertyPath(entry.path, focusNode, dataGraph, entry.head);
        } else {
          removePropertyPath(entry.path, focusNode, dataGraph, entry.value);
        }
      }
    });

    const originalQuads = originalQuadsRef.current!;
    const finalQuads = dataGraph.getQuads();
    const { additions, deletions } = diffQuads(originalQuads, finalQuads);

    const store = RdfStore.createDefault();
    for (const quad of finalQuads) store.addQuad(quad);

    onSubmit?.({ dataGraph: store, additions, deletions });
  };

  // A Modal editing its own staging graph (see Modal's `dataGraph` prop) pushes its scope here
  // while open, so Ctrl+Z/Ctrl+Y below acts on the innermost open one instead of always on this
  // form's own live dataGraph - see undoRedoScopeContext's own doc comment for why this needs to
  // be an explicit stack rather than relying on DOM/React event bubbling (a widget swap can move
  // focus outside this <form> entirely, e.g. to <body>, where a bubble-based handler scoped to the
  // form would never see the keypress at all).
  const undoRedoStackRef = useRef<UndoRedoScope[]>([]);
  const undoRedoScope = useMemo(
    () => ({
      push: (scope: UndoRedoScope) => {
        undoRedoStackRef.current.push(scope);
        return () => {
          const index = undoRedoStackRef.current.indexOf(scope);
          if (index !== -1) undoRedoStackRef.current.splice(index, 1);
        };
      },
    }),
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const scope = undoRedoStackRef.current.at(-1) ?? {
        dataGraph,
        enabled: enableUndoRedo ?? true,
      };
      if (!scope.enabled) return;
      const history = getHistory(scope.dataGraph);
      if (!history) return;
      if (!(event.ctrlKey || event.metaKey) || isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        history.undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        history.redo();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dataGraph, enableUndoRedo]);

  return (
    <undoRedoScopeContext.Provider value={undoRedoScope}>
      <submitAttemptContext.Provider value={{ hasAttemptedSubmit, markSubmitAttempted }}>
        <ValidationContextProvider latestResultsRef={latestValidationResultsRef}>
          <form onSubmit={handleSubmit} className="st-edit-mode">
            <header className="st-header">
              <InterfaceLanguageSwitcher />
              <ContentLanguageSwitcher />
            </header>

            <NodeUIComponent noWrapper />
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
    </undoRedoScopeContext.Provider>
  );
}
