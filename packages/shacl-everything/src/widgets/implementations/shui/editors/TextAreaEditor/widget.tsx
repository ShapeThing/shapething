import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function TextAreaEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  const minLength = shape.get(sh("minLength"));
  const maxLength = shape.get(sh("maxLength"));

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(value, xsd("string"))),
  );
  const ref = useAutoFocusRef<HTMLTextAreaElement>(autoFocus);

  return (
    <textarea
      ref={ref}
      className="st-input"
      value={localValue}
      onChange={onChange}
      onBlur={onBlur}
      minLength={minLength}
      maxLength={maxLength}
      aria-labelledby={labelledBy}
    >
      {localValue}
    </textarea>
  );
}
