import { useLocalization } from "@fluent/react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import DurationControlModule from "react-duration-control";
import { st } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { millisecondsFromTerm, termFromMilliseconds } from "./duration.ts";
import "./style.css";

// Only the props this widget actually passes below - see react-duration-control's own
// DurationControlProps (react-duration-control/dist/DurationControl.d.ts) for the full surface.
// Declared locally rather than imported from that dist file, which has no compiled .js this
// project's strict "nodenext" module resolution can resolve a type-only import to (the package
// bundles its runtime into one dist/index.js, with the per-module .d.ts files left unbacked).
type DurationControlProps = {
  pattern: string;
  value: number;
  hideSpinner?: boolean;
  onChange: (milliseconds: number) => void;
  onUnitBlur?: () => void;
};

// react-duration-control ships as a CJS module with `exports.default = DurationControl` - some
// bundler/test pipelines in this monorepo re-wrap that default export a second time on the way to
// an ESM `import`, landing the actual component at `.default` instead of the import itself (the
// exact same problem shacl-renderer's own port of this widget hit and worked around the same way).
const doubleWrapped = DurationControlModule as unknown as { default?: unknown };
const DurationControl = (
  typeof doubleWrapped === "object" && doubleWrapped !== null && "default" in doubleWrapped
    ? doubleWrapped.default
    : DurationControlModule
) as ComponentType<DurationControlProps>;

const UNITS = ["dd", "hh", "mm", "ss", "fff"] as const;

/**
 * DurationControl's `pattern` prop is plain text, not JSX - a translated unit label (e.g. "Days")
 * has to be spliced into the pattern string itself rather than rendered via <Localized>, unlike
 * every other widget in this codebase, whose own labels live outside whatever control they render.
 */
function withUnitLabels(pattern: string, labels: Record<(typeof UNITS)[number], string>): string {
  const parts = pattern.split("}{").map((part) => part.replace(/[{}]/g, ""));
  let result = pattern;
  for (const unit of UNITS) {
    const index = parts.indexOf(unit);
    if (index === -1) continue;
    const separator = index === parts.length - 1 ? "" : ",";
    result = result.replaceAll(`{${unit}}`, `{${unit}} ${labels[unit]}${separator} `);
  }
  return result;
}

export default function DurationEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const rawPattern = shape.get(st("durationPattern"))[0]?.value ?? "{dd}{hh}{mm}{ss}{fff}";
  const { l10n } = useLocalization();

  const pattern = withUnitLabels(rawPattern, {
    dd: l10n.getString("duration-editor-days", undefined, "Days"),
    hh: l10n.getString("duration-editor-hours", undefined, "Hours"),
    mm: l10n.getString("duration-editor-minutes", undefined, "Minutes"),
    ss: l10n.getString("duration-editor-seconds", undefined, "Seconds"),
    fff: l10n.getString("duration-editor-milliseconds", undefined, "Milliseconds"),
  });

  const [milliseconds, setMilliseconds] = useState(() => millisecondsFromTerm(term));
  // onUnitBlur fires within the same native event as the unit's own onChange, before this
  // render's setMilliseconds has necessarily committed - a ref (updated synchronously in
  // handleChange) rather than the state value itself is what lets the blur handler below reliably
  // read the value the user just typed.
  const millisecondsRef = useRef(milliseconds);

  useEffect(() => {
    const next = millisecondsFromTerm(term);
    millisecondsRef.current = next;
    setMilliseconds(next);
  }, [term]);

  return (
    <div className="st-duration-editor" aria-labelledby={labelledBy}>
      <DurationControl
        pattern={pattern}
        value={milliseconds}
        hideSpinner
        onChange={(value: number) => {
          millisecondsRef.current = value;
          setMilliseconds(value);
        }}
        onUnitBlur={() => setTerm(termFromMilliseconds(millisecondsRef.current))}
      />
    </div>
  );
}
