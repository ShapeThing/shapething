import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Localized } from "@fluent/react";
import type { CSSProperties, ReactNode } from "react";
import { DragHandle } from "@/helpers/icons.tsx";

/**
 * One draggable row inside a dnd-kit SortableContext: a drag handle followed by `children`. Its
 * own component because each row needs its own useSortable() instance - shared by MemberShapeList
 * (rdf:List items), PropertyUIComponentValues (st:orderBy values) and st:PropertyEditor (its tree
 * rows, indented through `style`).
 */
export default function SortableRow({
  id,
  as: Tag = "div",
  className,
  style: givenStyle,
  children,
}: {
  id: string;
  as?: "li" | "div";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { ...givenStyle, transform: CSS.Transform.toString(transform), transition };

  return (
    <Tag className={className} ref={setNodeRef} style={style}>
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
      {children}
    </Tag>
  );
}
