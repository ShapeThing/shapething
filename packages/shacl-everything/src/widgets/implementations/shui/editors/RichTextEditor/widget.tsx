import { useEffect, useId, useRef } from "react";
import "trix";
import { factory } from "@/helpers/factory.ts";
import { rdf } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

type TrixEditorElement = HTMLElement & { value: string };

const FOCUSED_CLASS = "st-rich-text-editor--focused";

export default function RichTextEditor({ term, setTerm }: WidgetProps) {
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TrixEditorElement>(null);

  // setTerm's identity changes on every edit (see PropertyUIComponentObject), so the mount effect
  // below reads it through a ref rather than closing over it directly.
  const setTermRef = useRef(setTerm);
  setTermRef.current = setTerm;

  // Trix owns the document once mounted (undo history, cursor position, ...), so the element is
  // built imperatively, once, instead of through JSX - a re-render must never recreate or
  // re-seed it. External value changes are pushed in by the sync effect further down, which
  // ignores the change this widget just emitted itself (tracked via lastValue).
  const lastValue = useRef(term.value);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const input = document.createElement("input");
    input.type = "hidden";
    input.id = inputId;
    input.value = lastValue.current;

    const editor = document.createElement("trix-editor") as TrixEditorElement;
    editor.setAttribute("input", inputId);

    const onChange = (event: Event) => {
      const html = (event.target as TrixEditorElement).value;
      lastValue.current = html;
      setTermRef.current(factory.literal(html, rdf("HTML")));
    };
    const onFocus = () => container.classList.add(FOCUSED_CLASS);
    const onBlur = () => container.classList.remove(FOCUSED_CLASS);

    editor.addEventListener("trix-change", onChange);
    editor.addEventListener("trix-focus", onFocus);
    editor.addEventListener("trix-blur", onBlur);
    container.append(input, editor);
    editorRef.current = editor;

    container.querySelectorAll(".trix-button").forEach((button) => {
      button.classList.add("st-button");
    });

    return () => {
      editor.removeEventListener("trix-change", onChange);
      editor.removeEventListener("trix-focus", onFocus);
      editor.removeEventListener("trix-blur", onBlur);
      container.replaceChildren();
      editorRef.current = null;
    };
  }, [inputId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && term.value !== lastValue.current) {
      lastValue.current = term.value;
      editor.value = term.value;
    }
  }, [term.value]);

  return <div className="st-rich-text-editor" ref={containerRef} />;
}
