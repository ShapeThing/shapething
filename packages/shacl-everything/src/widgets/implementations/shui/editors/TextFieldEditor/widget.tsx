import { factory } from "@/helpers/factory.ts";
import { rdf, sh, xsd } from "@/helpers/namespaces.ts";
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

// <input type="datetime-local"/"time"> omit seconds ("2024-05-01T09:30", "09:30"), but
// xsd:dateTime and xsd:time require them.
function withSeconds(value: string, type: HTMLInputElement["type"]): string {
  if (type === "datetime-local" && /T\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (type === "time" && /^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return value;
}

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

  // The shape's own sh:datatype wins over the input type's generic mapping - this widget is also
  // scored for custom datatypes (shui:hasCustomDatatype), and writing those back as xsd:string
  // would make every edit fail the very sh:datatype constraint it was chosen for. rdf:langString
  // is excluded: it's carried by a language tag, not a datatype argument (see coerceTermToBranch).
  const declared = shape.get(sh("datatype"));
  const datatype =
    declared?.termType === "NamedNode" && !declared.equals(rdf("langString"))
      ? declared
      : dataTypesMapping[type];

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(withSeconds(value, type), datatype)),
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
