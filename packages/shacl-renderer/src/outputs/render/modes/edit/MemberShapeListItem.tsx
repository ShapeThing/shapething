import type { Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { Suspense } from "react";
import { Loading, Minus } from "@/helpers/icons.tsx";
import SortableRow from "@/outputs/render/modes/edit/SortableRow.tsx";
import WidgetSlot from "@/outputs/render/modes/edit/WidgetSlot.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * One row of a MemberShapeList - a drag handle and a remove button around a WidgetSlot, which
 * resolves and renders this item's own widget generically (see MemberShapeList/WidgetSlot).
 */
export default function MemberShapeListItem({
  id,
  memberElement,
  value,
  labelledBy,
  canRemove,
  onChange,
  onRemove,
  autoFocus,
}: {
  id: string;
  memberElement: PropertyUIElement;
  value: Term;
  labelledBy: string;
  canRemove: boolean;
  onChange: (newValue: Term) => void;
  onRemove: () => void;
  autoFocus?: boolean;
}) {
  return (
    <SortableRow id={id} as="li" className="st-member-shape-list__item">
      <div className="st-member-shape-list__item-widget">
        <Suspense fallback={<Loading />}>
          <WidgetSlot
            propertyUIElement={memberElement}
            object={value}
            labelledBy={labelledBy}
            setTerm={onChange}
            autoFocus={autoFocus}
          />
        </Suspense>
      </div>
      <Localized id="member-shape-list-remove-item" attrs={{ "aria-label": true }}>
        <button
          type="button"
          className="st-button"
          disabled={!canRemove}
          aria-label="Remove item"
          onClick={onRemove}
        >
          <Minus />
        </button>
      </Localized>
    </SortableRow>
  );
}
