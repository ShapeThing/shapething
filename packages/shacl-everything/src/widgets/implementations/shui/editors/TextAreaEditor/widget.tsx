import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function TextAreaEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const minLength = shape.getOne(sh("minLength"))?.value;
  const maxLength = shape.getOne(sh("maxLength"))?.value;

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(value, xsd("string"))),
  );

  return (
    <textarea
      className="st-input"
      value={localValue}
      onChange={onChange}
      onBlur={onBlur}
      minLength={minLength ? parseInt(minLength) : undefined}
      maxLength={maxLength ? parseInt(maxLength) : undefined}
      aria-labelledby={labelledBy}
    >
      {localValue}
    </textarea>
  );
}
