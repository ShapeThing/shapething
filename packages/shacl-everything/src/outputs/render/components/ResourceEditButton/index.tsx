import type { Quad_Subject, Term } from "@rdfjs/types";
import "./style.css";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Localized } from "@fluent/react";
import { RdfStore } from "rdf-stores";
import { Edit } from "@/helpers/icons.tsx";
import { createStagingGraph, type StagingGraph } from "@/helpers/stagingGraph.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
import type { Widgets } from "@/widgets/types.ts";

// A throwaway, never-written-to store - stands in for `resourceEditor.dataGraph` in the
// useReactiveRead call below when no resource editing is offered at all, so that hook is always
// called with a real store (Rules of Hooks: it can't be skipped based on `resourceEditor` being
// present).
const noResourceDataGraph = RdfStore.createDefault();

export type ResourceEditor = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph?: RdfStore;
  widgetRegistry: Widgets;
  // The NodeShape(s) (typically a property shape's sh:node) describing `term`'s own properties -
  // an empty array means no shape is known for it, so there's nothing to render an editor with.
  nodeShapes: Quad_Subject[];
};

// The nested editor works against a StagingGraph (helpers/stagingGraph.ts) rather than
// `resourceEditor.dataGraph` directly, so edits only become real once Update is clicked - closing
// without submitting (or discarding a confirm prompt) can throw them away with nothing to undo.

type Props = {
  term: Term;
  // The resource's display label - used for the modal title and the button's accessible name.
  label: string;
  resourceEditor?: ResourceEditor;
  className?: string;
};

/**
 * Environment.enableEditInPlace's "edit" affordance for a referenced resource: a small edit icon
 * that opens `term` in a modal, rendered through `resourceEditor.nodeShapes`. Renders nothing
 * unless the feature is on, `term` is an IRI, a shape is known for it and it already exists in
 * `resourceEditor.dataGraph`. Shared by AutoCompleteOption (EnumSelectEditor, AutoCompleteEditor)
 * and IRIEditor.
 */
export default function ResourceEditButton({ term, label, resourceEditor, className }: Props) {
  const [staging, setStaging] = useState<StagingGraph | undefined>(undefined);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { enableEditInPlace } = useEnvironment();
  const queryClient = useQueryClient();

  const existsInDataGraph = useReactiveRead(
    resourceEditor?.dataGraph ?? noResourceDataGraph,
    `autocomplete-option-resource-exists@${term.value}`,
    () =>
      resourceEditor !== undefined &&
      term.termType === "NamedNode" &&
      resourceEditor.dataGraph.getQuads(term, null, null).length > 0,
  );

  const canEditResource =
    enableEditInPlace &&
    resourceEditor !== undefined &&
    term.termType === "NamedNode" &&
    resourceEditor.nodeShapes.length > 0 &&
    existsInDataGraph;

  const nodeUiElement = useMemo(() => {
    if (!staging || !resourceEditor || term.termType !== "NamedNode") return undefined;
    return new NodeUIElement({
      shapesGraph: resourceEditor.shapesGraph,
      dataGraph: staging.dataGraph,
      scoresGraph: resourceEditor.scoresGraph,
      widgetRegistry: resourceEditor.widgetRegistry,
      focusNode: term,
      nodeShapes: resourceEditor.nodeShapes,
    });
  }, [staging, resourceEditor, term]);

  const openEditor = () => {
    if (!resourceEditor) return;
    setStaging(createStagingGraph(resourceEditor.dataGraph));
    setConfirmDiscard(false);
  };

  // Applies the staged edits as the additions/deletions they actually are (not a blanket
  // replace-everything), the same way the outer form's own submit does - see EditModeWrapper.
  const commitEditor = () => {
    if (!staging) return;
    staging.commit();
    setStaging(undefined);
    setConfirmDiscard(false);
    // The edited resource's own label/classification/depiction (shown on the closed trigger and in the
    // dropdown) are resolved via react-query, not useReactiveRead - dataGraph's own reactivity has
    // no way to reach into that cache, so a commit wouldn't otherwise be reflected until something
    // unrelated happened to refetch it.
    queryClient.invalidateQueries({ queryKey: ["option-lookups"] });
    queryClient.invalidateQueries({ queryKey: ["select-options"] });
  };

  // Called for every way of dismissing the modal without submitting (header close, backdrop
  // click, Escape - see Modal). Closes straight away when nothing was actually changed; otherwise
  // asks first, since the staged edits would otherwise be silently thrown away.
  const requestCloseEditor = () => {
    if (!staging) return;
    const { additions, deletions } = staging.changes();
    if (additions.length === 0 && deletions.length === 0) {
      setStaging(undefined);
      return;
    }
    setConfirmDiscard(true);
  };

  const keepEditing = () => setConfirmDiscard(false);

  const discardChanges = () => {
    setStaging(undefined);
    setConfirmDiscard(false);
  };

  if (!canEditResource) return null;

  return (
    <>
      <Localized
        id="autocomplete-option-edit-resource"
        attrs={{ "aria-label": true }}
        vars={{ label }}
      >
        {/* Not a real <button>: this can itself be rendered inside another trigger button
          (EnumSelectEditor's own open/close control, via AutoCompleteOption), and a nested
          <button> is invalid HTML - a role="button" span gets the same semantics/keyboard support
          without that. */}
        <span
          role="button"
          tabIndex={0}
          className={`st-autocomplete-option__edit${className ? ` ${className}` : ""}`}
          aria-label={`Edit ${label}`}
          // Stops this from also toggling/closing whatever trigger this is rendered inside - see
          // the comment above.
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            openEditor();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            openEditor();
          }}
        >
          <Edit />
        </span>
      </Localized>
      {staging &&
        // This can itself be rendered inside another clickable trigger (EnumSelectEditor's own
        // open/close button) - a <dialog>, and any interactive content inside it (e.g. Modal's own
        // close button), can't validly nest inside a <button> at all, so this portals straight to
        // <body> rather than rendering inline. A portal only changes where React mounts the DOM
        // node, not which React tree it bubbles events through, so a click inside it would still
        // reach that outer trigger's own onClick unless stopped here too.
        createPortal(
          <span
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Modal
              open={true}
              onClose={requestCloseEditor}
              title={
                <Localized
                  id="autocomplete-option-edit-resource-title"
                  vars={{ label }}
                  elems={{ label: <em /> }}
                >
                  <span>
                    Edit <em>{label}</em>
                  </span>
                </Localized>
              }
              size="large"
              dataGraph={staging.dataGraph}
            >
              {/* A real <form>, not a plain div: unlike Modal's other consumers, this one is
                portaled to <body>, so it's never actually nested inside the page's own edit
                <form> - only wherever it renders in the React tree, which doesn't apply here. */}
              <form
                className="st-autocomplete-option__resource-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  commitEditor();
                }}
              >
                {nodeUiElement && <NodeUIElementChildren nodeUiElement={nodeUiElement} />}
                <div className="st-autocomplete-option__resource-form-actions">
                  <button type="submit" className="st-button st-button--primary">
                    <Localized id="node-ui-submit-update">Update</Localized>
                  </button>
                </div>
              </form>
            </Modal>
            <Modal
              open={confirmDiscard}
              onClose={keepEditing}
              title={<Localized id="autocomplete-option-discard-title">Discard changes?</Localized>}
            >
              <div className="st-autocomplete-option__discard-modal">
                <p>
                  <Localized id="autocomplete-option-discard-message" vars={{ label }}>
                    {`Discard your changes to ${label}? This cannot be undone.`}
                  </Localized>
                </p>
                <div className="st-autocomplete-option__discard-modal-actions">
                  <button type="button" className="st-button st-button--text" onClick={keepEditing}>
                    <Localized id="autocomplete-option-discard-cancel">Keep editing</Localized>
                  </button>
                  <button
                    type="button"
                    className="st-button st-button--danger"
                    onClick={discardChanges}
                  >
                    <Localized id="autocomplete-option-discard-confirm">Discard</Localized>
                  </button>
                </div>
              </div>
            </Modal>
          </span>,
          document.body,
        )}
    </>
  );
}
