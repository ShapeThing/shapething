import { sh } from "@/helpers/namespaces.ts";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
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
  const { enableLogicalBranchSwitching, enableWidgetSwitching, enableShPathInLabelTitle } =
    useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  // A data row's own gear icon (see DetailsEditor) only renders under this same condition - the
  // header's spacer has to match exactly, or its presence/absence would shift every column after
  // it out of alignment with the rows below.
  const showGearSpacer = enableLogicalBranchSwitching || enableWidgetSwitching;

  return (
    <div className="st-member-shape-list__item st-member-shape-list__header">
      <span
        className="st-button st-member-shape-list__handle st-member-shape-list__header-spacer"
        aria-hidden
      />
      <div className="st-member-shape-list__item-widget">
        <div className="st-details-editor">
          <div className="st-details-editor__body">
            <fieldset className="st-property-group st-property-group--horizontal">
              <div className="st-property-group__body">
                {columns.map((column, index) => (
                  <FormElement
                    key={index}
                    label={column.label([activeInterfaceLanguage])}
                    labelTitle={enableShPathInLabelTitle ? column.pathAsSparql() : undefined}
                    required={(column.get(sh("minCount")) ?? 0) > 0}
                    labelId={columnLabelId(index)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
          {showGearSpacer && (
            <span
              className="st-icon-button st-details-editor__options st-member-shape-list__header-spacer"
              aria-hidden
            />
          )}
        </div>
      </div>
      <span className="st-button st-member-shape-list__header-spacer" aria-hidden />
    </div>
  );
}
