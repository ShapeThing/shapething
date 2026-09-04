import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import type { NamedNode } from "@rdfjs/types";

const dataTypesMapping: Record<HTMLInputElement["type"], NamedNode> = {
  date: xsd("date"),
  "datetime-local": xsd("dateTime"),
  email: xsd("string"),
  month: xsd("gYearMonth"),
  number: xsd("decimal"),
  password: xsd("string"),
  search: xsd("string"),
  tel: xsd("string"),
  text: xsd("string"),
  time: xsd("time"),
  url: xsd("anyURI"),
  week: xsd("gYearWeek"),
} as const;

export default function TextFieldEditor({
  shape,
  term,
  setTerm,
  type = "text",
  labelledBy,
  autoFocus,
}: WidgetProps & { type?: HTMLInputElement["type"] }) {
  const pattern = shape.get(sh("pattern"))?.source;
  const minLength = shape.get(sh("minLength"));
  const maxLength = shape.get(sh("maxLength"));

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(value, dataTypesMapping[type])),
  );
  const ref = useAutoFocusRef<HTMLInputElement>(autoFocus);

  return (
    <input
      ref={ref}
      type={type}
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
