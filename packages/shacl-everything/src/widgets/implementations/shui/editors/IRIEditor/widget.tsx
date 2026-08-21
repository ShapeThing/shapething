import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function IRIEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const pattern = shape.get(sh("pattern"))?.source;
  const minLength = shape.get(sh("minLength"));
  const maxLength = shape.get(sh("maxLength"));

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.namedNode(value)),
  );

  return (
    <input
      type="text"
      className="st-input"
      value={localValue}
      onChange={onChange}
      onBlur={onBlur}
      pattern={pattern}
      minLength={minLength}
      maxLength={maxLength}
      aria-labelledby={labelledBy}
    />
  );
}
