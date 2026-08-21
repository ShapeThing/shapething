import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function IRIEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const pattern = shape.getOne(sh("pattern"))?.value;
  const minLength = shape.getOne(sh("minLength"))?.value;
  const maxLength = shape.getOne(sh("maxLength"))?.value;

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
      minLength={minLength ? parseInt(minLength) : undefined}
      maxLength={maxLength ? parseInt(maxLength) : undefined}
      aria-labelledby={labelledBy}
    />
  );
}
