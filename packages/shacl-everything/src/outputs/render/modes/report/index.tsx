import { Localized } from "@fluent/react";
import { useMemo } from "react";
import ContentLanguageSwitcher from "@/outputs/render/components/ContentLanguageSwitcher/index.tsx";
import InterfaceLanguageSwitcher from "@/outputs/render/components/InterfaceLanguageSwitcher/index.tsx";
import { indexValidationResults } from "@/outputs/render/contexts/validationIndex.ts";
import { reportResultsContext } from "@/outputs/render/contexts/reportResultsContext.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { localName } from "@/helpers/localName.ts";
import { termKey } from "@/helpers/termKey.ts";
import ReportNodeComponent from "@/outputs/render/modes/report/ReportNodeComponent.tsx";
import "@/outputs/render/modes/view/style.css";
import "./style.css";

const SEVERITIES = ["Violation", "Warning", "Info"];

/**
 * Renders a SHACL validation report (Environment.validationReport, matched onto the shapes by
 * preprocess/validationReport.ts): a count per severity, then one section per focus node showing
 * only its affected properties - through the regular view-mode tree, each result inline under the
 * property (and value) it's about, the same way edit mode shows live validation.
 */
export default function ReportModeWrapper() {
  const { report } = useEnvironment();
  const index = useMemo(() => indexValidationResults(report?.results ?? []), [report]);
  if (!report) return null;

  const all = [...report.results, ...report.focusNodes.flatMap((focusNode) => focusNode.nodeResults)];
  const counts = new Map<string, number>();
  for (const result of all) {
    const severity = localName(result.severity) ?? "Violation";
    const key = SEVERITIES.includes(severity) ? severity : "Other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    <div className="st-view-mode st-report-mode">
      <header className="st-header">
        <InterfaceLanguageSwitcher />
        <ContentLanguageSwitcher />
      </header>
      <p className="st-report-mode__summary" role="status">
        {all.length === 0 ? (
          <Localized id={report.conforms === false ? "report-does-not-conform" : "report-conforms"}>
            <span className="st-report-mode__count" data-severity="None" />
          </Localized>
        ) : (
          [...SEVERITIES, "Other"]
            .filter((severity) => counts.has(severity))
            .map((severity) => (
              <Localized
                key={severity}
                id={`report-count-${severity.toLowerCase()}`}
                vars={{ count: counts.get(severity)! }}
              >
                <span className="st-report-mode__count" data-severity={severity} />
              </Localized>
            ))
        )}
      </p>
      <reportResultsContext.Provider value={index}>
        {report.focusNodes.map((focusNode) => (
          <ReportNodeComponent key={termKey(focusNode.focusNode)} reportFocusNode={focusNode} />
        ))}
      </reportResultsContext.Provider>
    </div>
  );
}
