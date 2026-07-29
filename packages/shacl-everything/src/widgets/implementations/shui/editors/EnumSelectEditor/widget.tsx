import { sh } from "@/helpers/namespaces.ts";
import { localName } from "@/helpers/localName.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function EnumSelectEditor({ shape, term, setTerm }: WidgetProps) {
  const options = shape.get(sh("in"));

  return (
    <span className="st-select-wrapper">
      <select
        className="st-select"
        value={term.value}
        onChange={(e) => setTerm(options.find((option) => option.value === e.target.value) ?? term)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {localName(option) ?? option.value}
          </option>
        ))}
      </select>
      <span className="st-select-arrow" aria-hidden="true" />
    </span>
  );
}
