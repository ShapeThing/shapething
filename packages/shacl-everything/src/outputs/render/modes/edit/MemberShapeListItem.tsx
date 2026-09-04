import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { DragHandle, Minus } from "@/helpers/icons.tsx";
import WidgetSlot from "@/outputs/render/modes/edit/WidgetSlot.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * One row of a MemberShapeList - a drag handle and a remove button around a WidgetSlot, which
 * resolves and renders this item's own widget generically (see MemberShapeList/WidgetSlot). Its
 * own component (rather than inlined into MemberShapeList's .map()) because each row needs its
 * own useSortable() instance.
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li className="st-member-shape-list__item" ref={setNodeRef} style={style}>
      <Localized id="member-shape-list-reorder-item" attrs={{ "aria-label": true }}>
        <button
          type="button"
          className="st-button st-member-shape-list__handle"
          aria-label="Reorder item"
          {...listeners}
          {...attributes}
        >
          <DragHandle />
        </button>
      </Localized>
      <div className="st-member-shape-list__item-widget">
        <WidgetSlot
          propertyUIElement={memberElement}
          object={value}
          labelledBy={labelledBy}
          setTerm={onChange}
          autoFocus={autoFocus}
        />
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
    </li>
  );
}
