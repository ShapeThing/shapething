import type { WidgetProps } from "@shapething/shacl-renderer";
import { formatYear, yearOf } from "./year.ts";

/**
 * inf:YearViewer: the year of a Wikidata date. Wikidata dates are often only known to the year
 * while still written as a full date (1813-01-01), so the year is what can be shown for all of
 * them. See year.ts for the years before the common era.
 */
export default function YearViewer({ term }: WidgetProps) {
  const year = yearOf(term);
  return <span className="year-viewer">{year === undefined ? term.value : formatYear(year)}</span>;
}
