import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

/**
 * Parses an rdf:HTML value's markup into DOM elements via the same TipTap schema RichTextEditor
 * edits with, `editable: false` - reusing it here (rather than dangerouslySetInnerHTML) means
 * markup outside that schema (e.g. a stray <script>/event-handler attribute) is dropped by the
 * same parsing that already sanitizes it for editing, with no separate sanitizer dependency needed.
 */
export default function HTMLViewer({ term }: WidgetProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: term.value,
    editable: false,
  });

  useEffect(() => {
    if (editor && term.value !== editor.getHTML()) {
      editor.commands.setContent(term.value);
    }
  }, [editor, term.value]);

  return (
    <div className="st-html-viewer">
      <EditorContent editor={editor} />
    </div>
  );
}
