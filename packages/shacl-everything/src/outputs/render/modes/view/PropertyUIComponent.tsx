import { useId, useMemo } from "react";
import type { Term } from "@rdfjs/types";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import ResultMessages from "@/outputs/render/components/ValidationMessages/ResultMessages.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useRegisterContentLanguageSwitcherWidget } from "@/outputs/render/hooks/useRegisterContentLanguageSwitcherWidget.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useIsReport, useReportResults } from "@/outputs/render/hooks/useReportResults.tsx";
import { Localized } from "@fluent/react";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import MemberShapeList from "@/outputs/render/modes/view/MemberShapeList.tsx";
import PropertyUIComponentObject from "@/outputs/render/modes/view/PropertyUIComponentObject.tsx";
import { diffForValues } from "@/outputs/render/modes/view/propertyDiff.ts";
import { filterByContentLanguage } from "@/helpers/filterByContentLanguage.ts";
import { rdf, sh, shui } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { orderByPath, sortByOrderPath } from "@/structure/orderByValues.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";

type PropertyUIComponentProps = {
  propertyUIElement: PropertyUIElement;
};

/**
 * The view-mode counterpart to edit mode's PropertyUIComponent: same label/description chrome,
 * but read-only - no add/remove affordances, no empty-widget bookkeeping, and a property with no
 * values to show renders nothing at all rather than an empty field waiting to be filled in.
 */
export default function PropertyUIComponent({ propertyUIElement }: PropertyUIComponentProps) {
  const { languageMode, viewModeLabelLayout, sourcePrefixes, diffGraphs } = useEnvironment();
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const isRdfLangString = propertyUIElement.get(sh("datatype"))?.equals(rdf("langString"));
  // Resolved on the property shape alone (no valueNode), same reasoning as edit mode's own
  // early useWidget() call: this only needs whichever viewer would apply generically, to check
  // singleUnifiedWidget below - not the one a specific value might additionally score into.
  const widget = useWidget(shui("viewer"), propertyUIElement);
  useRegisterContentLanguageSwitcherWidget(Boolean(isRdfLangString));
  const memberShapeNodes = propertyUIElement.get(sh("memberShape"));

  const labelId = useId();
  const label = propertyUIElement.label([activeInterfaceLanguage]);
  const description = propertyUIElement.description([activeInterfaceLanguage]);

  const existingObjects = useDataGraphObjects(propertyUIElement);
  const unorderedLanguageFilteredObjects =
    languageMode === "individual"
      ? existingObjects
      : filterByContentLanguage(existingObjects, activeLanguage);
  // st:orderBy - same ordering as edit mode (see structure/orderByValues.ts).
  const orderPath = useMemo(() => orderByPath(propertyUIElement), [propertyUIElement]);
  const languageFilteredObjects = useReactiveRead(
    propertyUIElement.dataGraph,
    `order-by@${unorderedLanguageFilteredObjects.map(termKey).join("\n")}`,
    () =>
      orderPath
        ? sortByOrderPath(unorderedLanguageFilteredObjects, orderPath, propertyUIElement.dataGraph)
        : unorderedLanguageFilteredObjects,
  );

  // A singleUnifiedWidget (e.g. ValueTableViewer) renders once for the whole property and reads
  // every value itself via `shape` - see PropertyUIComponentValues' identical reasoning in edit
  // mode. Passing it every value here would render it once per value instead of once total.
  const isSingleUnifiedWidget = widget?.meta?.singleUnifiedWidget?.(propertyUIElement) === true;
  // Environment.additionsGraph/deletionsGraph - see propertyDiff.ts. Not for a singleUnifiedWidget,
  // which renders every value itself and so has no per-value slot to mark.
  const diff = useMemo(
    () =>
      diffGraphs && !isSingleUnifiedWidget
        ? diffForValues(propertyUIElement, languageFilteredObjects, diffGraphs)
        : undefined,
    [diffGraphs, isSingleUnifiedWidget, propertyUIElement, languageFilteredObjects],
  );
  // An edited text shows as one value (the new one, with the edit marked inside it), so the old
  // value it replaced isn't listed separately.
  const shownObjects = diff?.changedText
    ? languageFilteredObjects.filter((object) => !object.equals(diff.changedText!.removed))
    : languageFilteredObjects;
  const objects = isSingleUnifiedWidget ? shownObjects.slice(0, 1) : shownObjects;

  // Report mode (see modes/report/): every result about this property, listed below its label and
  // value(s).
  const isReport = useIsReport();
  const reportResults = useReportResults(propertyUIElement);

  // Nothing to view: unlike edit mode, there's no empty widget to fall back to - except a report's
  // result about the missing values themselves. Also gates the sh:memberShape branch below - a
  // list property with no head triple yet has nothing to walk.
  if (objects.length === 0 && reportResults.length === 0) return null;

  // "inline" only reads well for a single value sitting beside its label - a list of values (or
  // a singleUnifiedWidget like ValueTableViewer, inherently block-level) instead drops to its own
  // line below the label, same as "block", regardless of the global viewModeLabelLayout setting.
  // A report is always inline instead - the label beside the value(s), the results on the next line.
  const isList = memberShapeNodes.length > 0 || isSingleUnifiedWidget || objects.length > 1;
  const labelLayout = isReport ? "inline" : isList ? "block" : viewModeLabelLayout;

  const renderValues = (rowObjects: Term[], labelledBy: string) =>
    rowObjects.length === 0 ? (
      isReport ? (
        <Localized id="report-no-value">
          <span className="st-report-no-value">No value has been given</span>
        </Localized>
      ) : null
    ) : memberShapeNodes.length > 0 ? (
      <MemberShapeList
        propertyUIElement={propertyUIElement}
        memberShapeNodes={memberShapeNodes}
        labelledBy={labelledBy}
      />
    ) : (
      <div className="st-property-items">
        {rowObjects.map((object, index) => (
          <PropertyUIComponentObject
            key={index}
            propertyUIElement={propertyUIElement}
            object={object}
            labelledBy={labelledBy}
            diffStatus={diff?.status(object)}
            changedFrom={
              diff?.changedText?.added.equals(object) ? diff.changedText.removed : undefined
            }
          />
        ))}
      </div>
    );

  const renderRow = (
    key: string,
    rowLabelId: string,
    rowObjects: Term[],
    rowResults: ValidationResult[],
  ) => (
    <FormElement
      key={key}
      label={label}
      showColon={true}
      labelTitle={propertyUIElement.pathAsSparql({ prefixed: true, sourcePrefixes })}
      labelId={rowLabelId}
      dataId={propertyUIElement.dataId()}
      tooltip={description}
      labelLayout={labelLayout}
    >
      {renderValues(rowObjects, rowLabelId)}
      {isReport && (
        <ResultMessages results={rowResults} className="st-validation-messages--report" />
      )}
    </FormElement>
  );

  // In a report, a value with results of its own (e.g. sh:pattern, about that one value) gets a row
  // of its own, its messages right below it - otherwise, with several values, a message wouldn't
  // say which value it's about. The values without such results share one row, and results not
  // about any one shown value (sh:minCount, sh:maxCount, ...) come last.
  const resultsFor = (object: Term) =>
    reportResults.filter((result) => result.value?.equals(object));
  const ownRowObjects =
    isReport && objects.length > 1 && memberShapeNodes.length === 0
      ? objects.filter((object) => resultsFor(object).length > 0)
      : [];
  if (ownRowObjects.length > 0) {
    const sharedObjects = objects.filter((object) => !ownRowObjects.includes(object));
    const otherResults = reportResults.filter(
      (result) => !ownRowObjects.some((object) => result.value?.equals(object)),
    );
    // With no values left to share a row, the remaining results go below the last value instead
    // of in an empty row that would claim "No value has been given".
    const last = ownRowObjects.length - 1;
    const rows = ownRowObjects.map((object, index) =>
      renderRow(`value-${index}`, `${labelId}-${index}`, [object], [
        ...resultsFor(object),
        ...(index === last && sharedObjects.length === 0 ? otherResults : []),
      ])
    );
    if (sharedObjects.length > 0) {
      rows.push(renderRow("shared", labelId, sharedObjects, otherResults));
    }
    return <>{rows}</>;
  }

  return renderRow("all", labelId, objects, reportResults);
}
