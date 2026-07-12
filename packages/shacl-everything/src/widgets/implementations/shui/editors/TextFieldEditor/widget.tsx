import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function TextFieldEditor({ shape, term }: ObjectWidgetProps) {
  const pattern = shape.getOne(sh("pattern"))?.value;
  const minLength = shape.getOne(sh("minLength"))?.value;
  const maxLength = shape.getOne(sh("maxLength"))?.value;

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    shape.replaceObject(term, factory.literal(value)),
  );

  return (
    <input
      type="text"
      value={localValue}
      onChange={onChange}
      onBlur={onBlur}
      pattern={pattern}
      minLength={minLength ? parseInt(minLength) : undefined}
      maxLength={maxLength ? parseInt(maxLength) : undefined}
    />
  );
}
