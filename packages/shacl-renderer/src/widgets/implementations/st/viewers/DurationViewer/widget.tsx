import { useLocalization } from "@fluent/react";
import type { WidgetProps } from "@/widgets/types.ts";
import { formatDuration } from "./formatDuration.ts";

export default function DurationViewer({ term }: WidgetProps) {
  const { l10n } = useLocalization();

  const text = formatDuration(term, {
    years: l10n.getString("duration-viewer-years", undefined, "Years"),
    months: l10n.getString("duration-viewer-months", undefined, "Months"),
    days: l10n.getString("duration-viewer-days", undefined, "Days"),
    hours: l10n.getString("duration-viewer-hours", undefined, "Hours"),
    minutes: l10n.getString("duration-viewer-minutes", undefined, "Minutes"),
    seconds: l10n.getString("duration-viewer-seconds", undefined, "Seconds"),
    milliseconds: l10n.getString("duration-viewer-milliseconds", undefined, "Milliseconds"),
  });

  return <span className="st-duration-viewer">{text}</span>;
}
