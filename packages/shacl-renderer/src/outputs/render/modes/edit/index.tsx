import { clsx } from "clsx";
import type { ModeProps } from "@/outputs/render/render.tsx";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Localized } from "@fluent/react";
import type { Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { diffQuads } from "@/helpers/diffQuads.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { getHistory, transact, untracked } from "@/helpers/reactiveRdfStore.ts";
import { renameInQuads } from "@/helpers/renameTerm.ts";
import { termKey } from "@/helpers/termKey.ts";
import NodeUIComponent from "@/outputs/render/modes/edit/NodeUIComponent.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { orphanedTargetWhereObjects, shapesWhereTargetingFocusNode } from "@/resolution/targets.ts";
import { removePropertyPath } from "@/structure/paths/removePropertyPath.ts";
import { seedDefaultValues } from "@/structure/defaultValues.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { NO_WIDGETS } from "@/widgets/lookup.ts";
import ContentLanguageSwitcher from "@/outputs/render/components/ContentLanguageSwitcher/index.tsx";
import InterfaceLanguageSwitcher from "@/outputs/render/components/InterfaceLanguageSwitcher/index.tsx";
import Title from "@/outputs/render/components/Title/index.tsx";
import FocusNodeEditor from "@/outputs/render/components/FocusNodeEditor/index.tsx";
import ValidationContextProvider from "@/outputs/render/contexts/ValidationContextProvider.tsx";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import { submitAttemptContext } from "@/outputs/render/contexts/submitAttemptContext.tsx";
import {
  undoRedoScopeContext,
  type UndoRedoScope,
} from "@/outputs/render/contexts/undoRedoScopeContext.tsx";
import { worstSeverity } from "@/helpers/worstSeverity.ts";

type Props = ModeProps & {
  children?: React.ReactNode;
};

const quadKey = (quad: Quad) =>
  [quad.subject, quad.predicate, quad.object, quad.graph].map(termKey).join(" ");

// True for an element the browser already gives its own text-undo (a text input/textarea, or a
// contentEditable like RichTextEditor) - Ctrl+Z/Ctrl+Y there is left alone (see the keydown
// listener below) rather than fighting that native undo for an in-progress, not-yet-committed edit.
function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

// Which edit form Ctrl+Z/Ctrl+Y belongs to when several are on one page (ShaclUIApplication, web
// components, a nested renderer): the one the user last focused or clicked in. Focus alone isn't
// enough - a widget swap can drop focus to <body> (see the keydown listener below) - so the claim
// sticks until another form takes it. The first form to mount holds it until then.
let undoOwner: symbol | undefined;

export default function EditModeWrapper({ children, className }: Props) {
  const {
    focusNode,
    shapesGraph,
    dataGraph,
    scoresGraph,
    widgets,
    importedDataGraph,
    nodeShapes,
    readOnlyGraph,
    onSubmit,
    enableUndoRedo,
    enableTitle,
    enableFocusNodeEditor,
  } = useEnvironment();
  // What Environment.enableFocusNodeEditor's field has renamed the focus node to - applied to the
  // submitted quads only (see handleSubmit), so the live form keeps reading and writing the focus
  // node it was opened for.
  const [renamedFocusNode, setRenamedFocusNode] = useState(focusNode);
  // dataGraph's identity is stable for the life of this edit session (EnvironmentContextProvider
  // builds the Environment once and never rebuilds it), so this lazy initializer only ever runs on
  // this component's very first render - before any widget has had a chance to mutate dataGraph.
  const originalQuadsRef = useRef<Quad[] | null>(null);
  originalQuadsRef.current ??= dataGraph.getQuads();
  // The title's Create/Edit pick, fixed at mount (unlike the submit button's live hasTriples) so
  // "Create Person" doesn't turn into "Edit A" as soon as the user starts typing a name.
  const [isNew] = useState(() => dataGraph.getQuads(focusNode, null, null).length === 0);
  // A brand-new resource starts out with its shapes' sh:defaultValue values (see
  // structure/defaultValues.ts) - written after the mount-time snapshot above, so they're part of
  // what onSubmit reports as additions, but untracked, so Ctrl+Z can't undo past where the form
  // started. Runs before any widget mounts, so nothing has subscribed yet to re-render mid-render.
  const [seededQuadKeys] = useState(() => {
    if (!isNew) return new Set<string>();
    const node = new NodeUIElement({
      shapesGraph,
      dataGraph,
      scoresGraph,
      widgetRegistry: widgets ?? NO_WIDGETS,
      focusNode,
      nodeShapes,
    });
    return new Set(untracked(dataGraph, () => seedDefaultValues(node)).map(quadKey));
  });

  // Whether the focus node holds anything beyond its own seeded defaults - an untouched new
  // resource still reads "Create", not "Update", just because a default prefilled one field.
  const hasTriples = useReactiveRead(
    dataGraph,
    focusNode.value,
    () =>
      dataGraph
        .getQuads(focusNode, null, null)
        .some((quad) => !seededQuadKeys.has(quadKey(quad))),
  );

  // Whether the <form> below has been submitted at least once - usePropertyValidationResults
  // withholds validation results until this is true, so e.g. an untouched sh:minCount-violating
  // field doesn't show as an error before the user has tried to submit, matching how most form
  // libraries gate validation display. Data that already exists is shown validated straight away
  // though: its violations aren't the user's unfinished input, and are worth seeing before editing.
  // Held as plain local state (not read via useContext here)
  // and provided through its own narrow context rather than folded into ValidationContextProvider,
  // so a background revalidation run doesn't force *this* component to re-render: EditModeWrapper
  // sits above NodeUIComponent, and PropertyUIElement instances are rebuilt fresh on every render
  // (see structure/childrenForShape.ts) - re-rendering from up here would hand useWidget's Suspense
  // queries fresh cache keys for every property, remounting widgets mid-edit and stealing focus.
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(!isNew);
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
    const finalQuads = renamedFocusNode.equals(focusNode)
      ? dataGraph.getQuads()
      : renameInQuads(dataGraph.getQuads(), focusNode, renamedFocusNode);
    const { additions, deletions } = diffQuads(originalQuads, finalQuads);

    // Vocabulary merged in from owl:imports (see Environment.importedDataGraph) isn't the
    // embedder's own data, so it's left out of the returned graph. It never shows up in additions
    // (it was already part of the mount-time snapshot); removing one does show up in deletions.
    const store = RdfStore.createDefault();
    for (const quad of finalQuads) {
      const isImported =
        importedDataGraph !== undefined &&
        importedDataGraph.getQuads(quad.subject, quad.predicate, quad.object, quad.graph).length > 0;
      if (!isImported) store.addQuad(quad);
    }

    onSubmit?.({ dataGraph: store, additions, deletions, focusNode: renamedFocusNode });
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

  const [undoToken] = useState(() => Symbol("edit-form"));
  useEffect(() => {
    undoOwner ??= undoToken;
    return () => {
      if (undoOwner === undoToken) undoOwner = undefined;
    };
  }, [undoToken]);
  // React focus/pointer events bubble through portals, so a Modal opened from a widget in this
  // form (portaled to <body>) still claims undo for this form - and a nested form's own claim,
  // made after its ancestors' in the capture order, wins.
  const claimUndo = () => {
    undoOwner = undoToken;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (undoOwner !== undoToken) return;
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
  }, [dataGraph, enableUndoRedo, undoToken]);

  return (
    <undoRedoScopeContext.Provider value={undoRedoScope}>
      <submitAttemptContext.Provider value={{ hasAttemptedSubmit, markSubmitAttempted }}>
        <ValidationContextProvider latestResultsRef={latestValidationResultsRef}>
          <form
            onSubmit={handleSubmit}
            onFocusCapture={claimUndo}
            onPointerDownCapture={claimUndo}
            className={clsx("st-edit-mode", className)}
          >
            <header className="st-header">
              <InterfaceLanguageSwitcher />
              <ContentLanguageSwitcher />
            </header>
            {enableTitle && (
              <Title
                action={isNew ? "create" : "edit"}
                nodeShapes={nodeShapes}
                focusNode={focusNode}
              />
            )}
            {enableFocusNodeEditor && (
              <FocusNodeEditor
                current={focusNode}
                value={renamedFocusNode}
                onChange={setRenamedFocusNode}
                dataGraph={dataGraph}
                shapesGraph={shapesGraph}
                nodeShapes={nodeShapes}
              />
            )}

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
