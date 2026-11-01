import { javascript } from "@codemirror/lang-javascript";
import { StreamLanguage } from "@codemirror/language";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { highlighting } from "../examples/highlighting";

const languages = {
  turtle: () => StreamLanguage.define(turtle),
  typescript: () => javascript({ typescript: true }),
  json: () => javascript(),
};

/**
 * A read-only, highlighted piece of code with a label above it.
 */
export function CodeBlock({
  code,
  language,
  label,
}: {
  code: string;
  language: keyof typeof languages;
  label: string;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);

  useEffect(() => {
    view.current = new EditorView({
      parent: parent.current!,
      state: EditorState.create({
        doc: code,
        extensions: [
          minimalSetup,
          highlighting,
          languages[language](),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
        ],
      }),
    });
    return () => view.current?.destroy();
  }, [language]);

  useEffect(() => {
    const current = view.current;
    if (current && current.state.doc.toString() !== code) {
      current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: code } });
    }
  }, [code]);

  return (
    <div className="code-block">
      <span className="code-block__label">{label}</span>
      <div ref={parent} />
    </div>
  );
}
