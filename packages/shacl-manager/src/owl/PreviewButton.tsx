import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { rdf, ShaclRenderer } from "@shapething/shacl-renderer";
import { RdfStore } from "rdf-stores";
import { use, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { factory, type Resource } from "../data-model/rdf.ts";
import { useRendererSettings } from "../app/rendererProps.ts";
import { LanguagesContext, useTermLabel } from "../app/termLabel.ts";
import { classShapes } from "./classShapes.ts";

type Tab = "view" | "edit";
const tabs: { value: Tab; label: string }[] = [
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
];

// Opens an example instance of the class, generated from the shapes that apply to it. Only shown
// when some shape does.
export function PreviewButton({ term }: { term: Resource }) {
  const { store } = useDataModel();
  const nodeShapes = useMemo(() => classShapes(store, term), [store, term]);
  const [open, setOpen] = useState(false);
  if (!nodeShapes.length) return null;

  return (
    <>
      <button type="button" className="st-button" onClick={() => setOpen(true)}>
        Preview
      </button>
      {open && <PreviewDialog term={term} nodeShapes={nodeShapes} onClose={() => setOpen(false)} />}
    </>
  );
}

type PreviewDialogProps = { term: Resource; nodeShapes: Quad_Subject[]; onClose: () => void };

function PreviewDialog({ term, nodeShapes, onClose }: PreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const termLabel = useTermLabel();
  const id = useId();
  const [tab, setTab] = useState<Tab>("view");
  const generated = useGenerated(term, nodeShapes);
  const preview = generated && "focusNode" in generated ? generated : undefined;
  // An edit replaces the generated data, so the View tab shows it too.
  const [edited, setEdited] = useState<RdfStore>();
  const dataGraph = edited ?? preview?.dataGraph;

  const { store } = useDataModel();
  const settings = useRendererSettings();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="st-modal st-modal--large st-preview-dialog"
      // The renderer's own modals are <dialog>s too, and their close events bubble up to here.
      onClose={(event) => event.target === dialogRef.current && onClose()}
    >
      <div className="st-modal__content">
        <header className="st-modal__header">
          <h2 className="st-modal__title">Preview of {termLabel(term)}</h2>
          <button type="button" className="st-icon-button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <nav className="st-section__tabs" role="tablist">
          {tabs.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${id}-${value}`}
              aria-controls={`${id}-panel`}
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tab}`}
          className="st-preview-dialog__panel"
        >
          {generated && "error" in generated ? (
            <p>Could not generate an example: {String(generated.error)}</p>
          ) : !preview || !dataGraph ? (
            <p>Generating an example…</p>
          ) : (
            <ShaclRenderer
              key={tab}
              {...settings}
              shapesGraph={store}
              nodeShapes={nodeShapes}
              dataGraph={dataGraph}
              focusNode={preview.focusNode}
              {...(tab === "view"
                ? { mode: "view", viewModeLabelLayout: "columns" }
                : {
                    mode: "edit",
                    onSubmit: (result) => {
                      setEdited(result.dataGraph);
                      setTab("view");
                    },
                  })}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}

// An example instance of the class, generated once per opening. It starts from a copy of the data
// model, so references can point at resources it already has.
function useGenerated(term: Resource, nodeShapes: Quad_Subject[]) {
  const { store } = useDataModel();
  const [language] = use(LanguagesContext);
  const [preview, setPreview] = useState<
    { focusNode: NamedNode; dataGraph: RdfStore } | { error: unknown }
  >();

  useEffect(() => {
    let current = true;
    (async () => {
      // Loaded on demand: generating brings in faker.
      const { generate } = await import("@shapething/shacl-renderer/tools");
      const focusNode = factory.namedNode(`urn:shapething:preview:${crypto.randomUUID()}`);
      const dataGraph = RdfStore.createDefault();
      for (const quad of store.getQuads()) dataGraph.addQuad(quad);
      await generate({
        shapesGraph: store,
        dataGraph,
        focusNode,
        nodeShapes,
        ...(language && { contentLanguage: language }),
      });
      // generate types the instance with its shapes' target classes, which may be superclasses.
      if (term.termType === "NamedNode") {
        dataGraph.addQuad(factory.quad(focusNode, rdf("type"), term));
      }
      if (current) setPreview({ focusNode, dataGraph });
    })().catch((error) => {
      console.error("[shacl-manager] Could not generate a preview:", error);
      if (current) setPreview({ error });
    });
    return () => {
      current = false;
    };
  }, [store, term, nodeShapes, language]);

  return preview;
}
