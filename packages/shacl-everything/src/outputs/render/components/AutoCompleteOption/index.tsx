import type { NamedNode, Quad, Quad_Subject, Term } from "@rdfjs/types";
import "./style.css";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Localized } from "@fluent/react";
import { RdfStore } from "rdf-stores";
import { EditNested, Link } from "@/helpers/icons.tsx";
import { highlightMatches } from "@/helpers/highlightMatches.tsx";
import { localName } from "@/helpers/localName.ts";
import { diffQuads } from "@/helpers/diffQuads.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";

// A throwaway, never-written-to store - stands in for `resourceEditor.dataGraph` in the
// useReactiveRead call below when this option can't offer resource editing at all, so that hook
// is always called with a real store (Rules of Hooks: it can't be skipped based on `resourceEditor`
// being present).
const noResourceDataGraph = RdfStore.createDefault();

export type ResourceEditor = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph?: RdfStore;
  // The NodeShape(s) (typically a property shape's sh:node) describing `term`'s own properties -
  // an empty array means no shape is known for it, so there's nothing to render an editor with.
  nodeShapes: Quad_Subject[];
};

// The nested editor works against its own copy of the whole graph rather than
// `resourceEditor.dataGraph` directly, so edits only become real once Update is clicked - closing
// without submitting (or discarding a confirm prompt) can throw them away with nothing to undo.
type Staging = { dataGraph: RdfStore; originalQuads: Quad[] };

type Props = {
  term: Term;
  label?: string;
  subLabel?: string;
  depiction?: NamedNode;
  highlight?: string;
  // Only passed for the currently selected value (never for a row in a dropdown list) - see
  // EnumSelectEditor. Offers a small "edit" affordance that opens `term` in a modal, rendered
  // through `nodeShapes`, when `term` both has a known shape and already exists in `dataGraph`.
  resourceEditor?: ResourceEditor;
};

export default function AutoCompleteOption({
  term,
  label,
  subLabel,
  depiction,
  highlight,
  resourceEditor,
}: Props) {
  const [hasError, setHasError] = useState<boolean | undefined>(undefined);
  const [staging, setStaging] = useState<Staging | undefined>(undefined);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { enableEditInPlace } = useEnvironment();
  const queryClient = useQueryClient();
  const displayLabel = label ?? localName(term) ?? term.value;
  const isDirectRenderable =
    depiction?.value.includes(".svg") || depiction?.value.includes("data:");

  const existsInDataGraph = useReactiveRead(
    resourceEditor?.dataGraph ?? noResourceDataGraph,
    `autocomplete-option-resource-exists@${term.value}`,
    () =>
      resourceEditor !== undefined &&
      term.termType === "NamedNode" &&
      resourceEditor.dataGraph.getQuads(term, null, null).length > 0,
  );

  const canEditResource =
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
      focusNode: term,
      nodeShapes: resourceEditor.nodeShapes,
    });
  }, [staging, resourceEditor, term]);

  const openEditor = () => {
    if (!resourceEditor) return;
    const originalQuads = resourceEditor.dataGraph.getQuads();
    const stagingDataGraph = makeReactive(RdfStore.createDefault());
    for (const quad of originalQuads) stagingDataGraph.addQuad(quad);
    setStaging({ dataGraph: stagingDataGraph, originalQuads });
    setConfirmDiscard(false);
  };

  // Applies the staged edits as the additions/deletions they actually are (not a blanket
  // replace-everything), the same way the outer form's own submit does - see EditModeWrapper.
  const commitEditor = () => {
    if (!staging || !resourceEditor) return;
    const { additions, deletions } = diffQuads(staging.originalQuads, staging.dataGraph.getQuads());
    for (const quad of deletions) resourceEditor.dataGraph.removeQuad(quad);
    for (const quad of additions) resourceEditor.dataGraph.addQuad(quad);
    setStaging(undefined);
    setConfirmDiscard(false);
    // The edited resource's own label/subLabel/depiction (shown on the closed trigger and in the
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
    const { additions, deletions } = diffQuads(staging.originalQuads, staging.dataGraph.getQuads());
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

  return (
    <span className="st-autocomplete-option">
      {depiction && !hasError ? (
        <img
          loading="lazy"
          onError={() => setHasError(true)}
          onLoad={() => setHasError(false)}
          className="st-autocomplete-option__depiction"
          src={
            isDirectRenderable
              ? depiction.value
              : `//wsrv.nl/?url=${encodeURIComponent(depiction.value)}&w=64&h=64&fit=cover`
          }
          alt=""
        />
      ) : (
        <span className="st-autocomplete-option__depiction-spacer"></span>
      )}
      <span className="st-autocomplete-option__label">
        {highlightMatches(displayLabel, highlight, "st-autocomplete-option__match")}
      </span>
      {subLabel && (
        <span className="st-autocomplete-option__sub-label">
          {highlightMatches(subLabel, highlight, "st-autocomplete-option__match")}
        </span>
      )}
      {term.termType === "NamedNode" && (
        <span className="st-autocomplete-option__actions">
          {canEditResource && enableEditInPlace && (
            <Localized
              id="autocomplete-option-edit-resource"
              attrs={{ "aria-label": true }}
              vars={{ label: displayLabel }}
            >
              {/* Not a real <button>: this option can itself be rendered inside another trigger
                  button (EnumSelectEditor's own open/close control), and a nested <button> is
                  invalid HTML - a role="button" span gets the same semantics/keyboard support
                  without that. */}
              <span
                role="button"
                tabIndex={0}
                className="st-autocomplete-option__edit"
                aria-label={`Edit ${displayLabel}`}
                // Stops this from also toggling/closing whatever trigger this option is rendered
                // inside - see the comment above.
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
                <EditNested />
              </span>
            </Localized>
          )}
          {term.termType === "NamedNode" && (
            <a
              className="st-autocomplete-option__iri"
              href={term.value}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Link />
            </a>
          )}
        </span>
      )}
      {staging &&
        // This option can itself be rendered inside another clickable trigger (EnumSelectEditor's
        // own open/close button) - a <dialog>, and any interactive content inside it (e.g. Modal's
        // own close button), can't validly nest inside a <button> at all, so this portals straight
        // to <body> rather than rendering inline. A portal only changes where React mounts the
        // DOM node, not which React tree it bubbles events through, so a click inside it would
        // still reach that outer trigger's own onClick unless stopped here too.
        createPortal(
          <span
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Modal open={true} onClose={requestCloseEditor} title={displayLabel}>
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
                  <Localized
                    id="autocomplete-option-discard-message"
                    vars={{ label: displayLabel }}
                  >
                    {`Discard your changes to ${displayLabel}? This cannot be undone.`}
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
    </span>
  );
}
