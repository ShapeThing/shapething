import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import { formatDate } from "./formatDate.ts";

/**
 * st:DateViewer: an xsd date literal as the interface language writes it ("11 November 1855"),
 * rather than its lexical form. See formatDate.ts for which parts are shown.
 */
export default function DateViewer({ term }: WidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  // HTML's datetime attribute has no years before the common era.
  const dateTime = term.value.startsWith("-") ? undefined : term.value;
  return (
    <time className="st-date-viewer" dateTime={dateTime}>
      {formatDate(term, activeInterfaceLanguage)}
    </time>
  );
}
