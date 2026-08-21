import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { factory } from "@/helpers/factory.ts";
import { rdf } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

type ToolbarButton = { label: string; title: string; active: boolean; onClick: () => void };

function ToolbarBtn({ label, title, active, onClick }: ToolbarButton) {
  return (
    <button
      type="button"
      className={`st-button st-button--text st-rte-btn${active ? " is-active" : ""}`}
      // preventDefault keeps editor focus when clicking toolbar buttons
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (label: string, title: string, active: boolean, onClick: () => void) => (
    <ToolbarBtn key={title} label={label} title={title} active={active} onClick={onClick} />
  );
  return (
    <div className="st-rte-toolbar" aria-label="Text formatting">
      {btn("B", "Bold", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run())}
      {btn("I", "Italic", editor.isActive("italic"), () =>
        editor.chain().focus().toggleItalic().run(),
      )}
      <span className="st-rte-toolbar__sep" />
      {btn("• List", "Bullet list", editor.isActive("bulletList"), () =>
        editor.chain().focus().toggleBulletList().run(),
      )}
      {btn("1. List", "Ordered list", editor.isActive("orderedList"), () =>
        editor.chain().focus().toggleOrderedList().run(),
      )}
      <span className="st-rte-toolbar__sep" />
      {btn("❝", "Blockquote", editor.isActive("blockquote"), () =>
        editor.chain().focus().toggleBlockquote().run(),
      )}
    </div>
  );
}

export default function RichTextEditor({ term, setTerm, labelledBy }: WidgetProps) {
  const setTermRef = useRef(setTerm);
  setTermRef.current = setTerm;

  // Track the last HTML we emitted so external updates don't fight the editor.
  const lastEmitted = useRef(term.value);
  // Suppress onUpdate while we're pushing in an external value change.
  const isExternalUpdate = useRef(false);

  const onUpdate = useCallback(({ editor }: { editor: { getHTML: () => string } }) => {
    if (isExternalUpdate.current) return;
    const html = editor.getHTML();
    lastEmitted.current = html;
    setTermRef.current(factory.literal(html, rdf("HTML")));
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: term.value,
    onUpdate,
  });

  // Push external value changes in without disturbing cursor position.
  useEffect(() => {
    if (editor && term.value !== lastEmitted.current) {
      lastEmitted.current = term.value;
      isExternalUpdate.current = true;
      editor.commands.setContent(term.value);
      isExternalUpdate.current = false;
    }
  }, [editor, term.value]);

  return (
    <div className="st-rich-text-editor" aria-labelledby={labelledBy}>
      <EditorContent editor={editor} />
      {editor && <Toolbar editor={editor} />}
    </div>
  );
}
