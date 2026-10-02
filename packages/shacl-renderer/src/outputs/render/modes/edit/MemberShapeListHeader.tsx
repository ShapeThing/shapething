import { languageLabels } from "@/helpers/languageLabels.ts";
import { Settings } from "@/helpers/icons.tsx";
import { rdf, sh } from "@/helpers/namespaces.ts";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * The one-time column-label row for a MemberShapeList whose items collapse into a single
 * st:HorizontalPropertyGroup (see MemberShapeList's own tableColumns) - rendered once, above and
 * entirely outside the sortable <ul>/DndContext, so it can never be carried along by a row's own
 * drag transform the way an earlier attempt at this (tying the header to "row 1") was.
 *
 * Its markup deliberately mirrors one data row's own class structure (MemberShapeListItem ->
 * WidgetSlot -> DetailsEditor -> HorizontalPropertyGroup), with inert, visually-hidden stand-ins
 * for the drag handle/gear/remove button, so its column labels land in the same flex columns a
 * real row's inputs do via the exact same CSS rules - rather than a parallel layout system (CSS
 * grid/subgrid) that would need to be kept in sync with it by hand.
 */
export default function MemberShapeListHeader({
  columns,
  columnLabelId,
}: {
  columns: PropertyUIElement[];
  columnLabelId: (index: number) => string;
}) {
  return (
    <div className="st-member-shape-list__item st-member-shape-list__header">
      <span
        className="st-button st-member-shape-list__handle st-member-shape-list__header-spacer"
        aria-hidden
      />
      <div className="st-member-shape-list__item-widget">
        <TableHeaderColumns columns={columns} columnLabelId={columnLabelId} />
      </div>
      <span className="st-button st-member-shape-list__header-spacer" aria-hidden />
    </div>
  );
}

/**
 * The part of a table-mode header shared by both list kinds (MemberShapeListHeader here, and
 * PropertyUIComponentValuesHeader for an ordinary multi-valued property): the column labels,
 * laid out with one row's own DetailsEditor -> HorizontalPropertyGroup class structure. Each
 * caller wraps it in its own row kind's outer markup, so the handle/remove stand-ins line up with
 * that kind's real controls.
 */
export function TableHeaderColumns({
  columns,
  columnLabelId,
}: {
  columns: PropertyUIElement[];
  columnLabelId: (index: number) => string;
}) {
  const {
    enableLogicalBranchSwitching,
    enableWidgetSwitching,
    enableShPathInLabelTitle,
    languageMode,
    sourcePrefixes,
  } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { activeLanguage } = useContentLanguage();
  // A data row's own gear icon (see DetailsEditor) only renders under this same condition - the
  // header's spacer has to match exactly, or its presence/absence would shift every column after
  // it out of alignment with the rows below.
  const showGearSpacer = enableLogicalBranchSwitching || enableWidgetSwitching;

  return (
    <div className="st-details-editor">
      <div className="st-details-editor__body">
        <fieldset className="st-property-group st-property-group--horizontal">
          <div className="st-property-group__body">
            {columns.map((column, index) => {
              const isRdfLangString = column.get(sh("datatype"))?.equals(rdf("langString"));
              const showLanguageTag =
                Boolean(activeLanguage) && isRdfLangString && languageMode === "switcher";
              return (
                <FormElement
                  key={index}
                  label={column.label([activeInterfaceLanguage])}
                  labelSuffix={
                    showLanguageTag ? (
                      <span className="st-property-language-tag">
                        ({Object.values(languageLabels([activeLanguage], activeInterfaceLanguage))})
                      </span>
                    ) : undefined
                  }
                  labelTitle={enableShPathInLabelTitle
                    ? column.pathAsSparql({ prefixed: true, sourcePrefixes })
                    : undefined}
                  required={(column.get(sh("minCount")) ?? 0) > 0}
                  labelId={columnLabelId(index)}
                />
              );
            })}
          </div>
        </fieldset>
      </div>
      {/* A real (but invisible, inert) copy of DetailsEditor's own gear button rather than a
          sized <span>: .st-icon-button's width comes from aspect-ratio against its height plus
          the UA's own <button> box, which a span stand-in with a fixed width never matched -
          shifting every column of the header out of line with the rows below it. */}
      {showGearSpacer && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="st-icon-button st-details-editor__options st-table-header__invisible"
        >
          <Settings />
        </button>
      )}
    </div>
  );
}
