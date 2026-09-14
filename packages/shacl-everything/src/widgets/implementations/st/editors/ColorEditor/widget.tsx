import { factory } from "@/helpers/factory.ts";
import { colorDatatype } from "@/helpers/namespaces.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
// <input type="color"> only ever accepts a full 6-digit hex value - shown while the committed/
// in-progress text doesn't parse as one yet (e.g. still empty, or mid-edit), never written back.
const FALLBACK_SWATCH_COLOR = "#000000";

/**
 * A value here is a plain string literal in 6-digit hex form (e.g. "#3b82f6"), typed with the
 * colorDatatype sentinel (see namespaces.ts) - the same "sentinel sh:datatype names a value
 * convention" idiom IconifyEditor uses for icon names. The swatch and the text field both read/
 * write that one literal, so typing a hex value updates the swatch preview and picking a color
 * from the native picker updates the text.
 */
export default function ColorEditor({ term, setTerm, labelledBy, autoFocus }: WidgetProps) {
  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(value, colorDatatype)),
  );
  const ref = useAutoFocusRef<HTMLInputElement>(autoFocus);
  const swatchValue = HEX_COLOR_PATTERN.test(localValue) ? localValue : FALLBACK_SWATCH_COLOR;

  return (
    <span className="st-color-editor">
      <input
        type="color"
        className="st-color-editor__swatch"
        value={swatchValue}
        onChange={(event) => setTerm(factory.literal(event.target.value, colorDatatype))}
        aria-labelledby={labelledBy}
      />
      <input
        ref={ref}
        type="text"
        className="st-input st-color-editor__hex"
        value={localValue}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="#000000"
        pattern={HEX_COLOR_PATTERN.source}
        aria-labelledby={labelledBy}
      />
    </span>
  );
}
