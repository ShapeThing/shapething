import { useEffect, useRef } from "react";
import { useLocalization } from "@fluent/react";
import EditorJS, { type OutputData } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import type { Quad_Subject } from "@rdfjs/types";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import { readOutputData, stableStringify, writeOutputData } from "./outputData.ts";
import "./style.css";

const tools = { header: Header, list: List };

// Only the document's actual content counts towards "did this change" - ed:time is rewritten on
// every save(), so comparing it too would make every onChange (including the one Editor.js fires
// right after render()) look like a real edit.
const contentKey = (data: OutputData | undefined) => stableStringify(data?.blocks ?? []);

/**
 * Ported from shacl-renderer's own EditorJsEditor: a block-based Editor.js
 * (https://editorjs.io) document stored as a nested ed:OutputData node (see outputData.ts for the
 * RDF layout). Unlike DetailsEditor, this never recurses into the value's own sh:node - the widget
 * owns the ed:* subgraph directly and rewrites it wholesale on every change. Headers and lists are
 * the only tools enabled, the same pair the original shipped.
 */
export default function EditorJsEditor({ shape, term, setTerm, labelledBy, autoFocus }: WidgetProps) {
  const node = term as Quad_Subject;
  const { l10n } = useLocalization();
  const holderRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorJS | undefined>(undefined);

  const stored = useReactiveRead(shape.dataGraph, `editor-js@${term.value}`, () =>
    stableStringify(readOutputData(shape.dataGraph, node) ?? null),
  );
  // What the editor itself currently shows, as contentKey - lets onChange skip no-op saves and
  // lets the effect below tell an outside change (undo/redo) apart from this editor's own write.
  const shownContent = useRef(contentKey(JSON.parse(stored) ?? undefined));

  // Latest props for Editor.js's own callbacks, which are bound once at construction.
  const latest = useRef({ shape, node, term, setTerm });
  latest.current = { shape, node, term, setTerm };

  useEffect(() => {
    if (!holderRef.current) return;
    const initial = JSON.parse(stored) as OutputData | null;

    const editor = new EditorJS({
      holder: holderRef.current,
      data: initial ?? undefined,
      tools,
      placeholder: l10n.getString("editor-js-placeholder", undefined, "Add some content…"),
      autofocus: autoFocus,
      // Editor.js defaults to 300px of empty clickable space below the last block - far too much
      // for one field among many in a form.
      minHeight: 0,
      onChange: async (api) => {
        const output = await api.saver.save();
        const key = contentKey(output);
        if (key === shownContent.current) return;
        shownContent.current = key;

        const { shape, node, term, setTerm } = latest.current;
        transact(shape.dataGraph, () => {
          writeOutputData(shape.dataGraph, node, output);
          // Same as AddressEditor: a blank node's identity never changes when its subgraph is
          // rewritten - this re-affirms `term` as the property's value, which is what links a
          // freshly-created (not yet reachable) node in for the first time.
          setTerm(term);
        });
      },
    });
    editorRef.current = editor;

    return () => {
      editorRef.current = undefined;
      // destroy() before isReady resolves throws inside Editor.js (StrictMode's double mount hits
      // exactly this) - wait for it instead.
      editor.isReady.then(() => editor.destroy()).catch(() => {});
    };
    // Editor.js owns its own DOM and state once constructed - external value changes are pushed
    // in by the effect below rather than by re-creating the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pushes an outside change to the stored document (undo/redo, another widget writing the same
  // node) into the running editor. This editor's own writes already updated shownContent, so they
  // fall straight through.
  useEffect(() => {
    const data = (JSON.parse(stored) as OutputData | null) ?? undefined;
    const key = contentKey(data);
    if (key === shownContent.current) return;
    shownContent.current = key;

    const editor = editorRef.current;
    editor?.isReady
      .then(() => (data?.blocks.length ? editor.render(data) : editor.clear()))
      .catch(() => {});
  }, [stored]);

  return (
    <div
      ref={holderRef}
      className="st-editor-js-editor"
      role="group"
      aria-labelledby={labelledBy}
    />
  );
}
