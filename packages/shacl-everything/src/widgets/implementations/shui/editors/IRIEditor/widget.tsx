import { factory } from "@/helpers/factory.ts";
import { Link } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function IRIEditor({ shape, term, setTerm, labelledBy, autoFocus }: WidgetProps) {
  const pattern = shape.get(sh("pattern"))?.source;
  const minLength = shape.get(sh("minLength"));
  const maxLength = shape.get(sh("maxLength"));

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.namedNode(value)),
  );
  const ref = useAutoFocusRef<HTMLInputElement>(autoFocus);

  return (
    <>
      {/* <span className="st-input-prefix">
        <Link />
      </span> */}
      <input
        ref={ref}
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
      <span className="st-input-suffix">
        <Link />
      </span>
    </>
  );
}
