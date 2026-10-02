import { TableHeaderColumns } from "@/outputs/render/modes/edit/MemberShapeListHeader.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * The one-time column-label row for an ordinary multi-valued property whose values collapse into
 * a single st:HorizontalPropertyGroup (see PropertyUIComponentValues' own tableColumns) - the
 * plain-value counterpart of MemberShapeListHeader. Its markup mirrors one value row's own class
 * structure (SortableRow when st:orderBy applies -> PropertyUIComponentObject -> WidgetSlot ->
 * DetailsEditor), with inert stand-ins for the drag handle and remove button, so its labels land
 * in the same flex columns a real row's inputs do.
 */
export default function PropertyUIComponentValuesHeader({
  columns,
  columnLabelId,
  sortable,
}: {
  columns: PropertyUIElement[];
  columnLabelId: (index: number) => string;
  sortable: boolean;
}) {
  return (
    <div className={sortable ? "st-property-sortable-item" : undefined}>
      {sortable && (
        <span
          className="st-button st-member-shape-list__handle st-member-shape-list__header-spacer"
          aria-hidden
        />
      )}
      <div className="st-property-object-wrapper">
        <div className="st-property-object">
          <div className="st-property-object-main">
            <div className="st-property-object__widget">
              <TableHeaderColumns columns={columns} columnLabelId={columnLabelId} />
            </div>
          </div>
          <span className="st-button st-member-shape-list__header-spacer" aria-hidden />
        </div>
      </div>
    </div>
  );
}
