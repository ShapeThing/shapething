import type { NamedNode, Term } from "@rdfjs/types";
import { useEffect, useMemo, useRef } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Localized } from "@fluent/react";
import { getRdfListCells, rebuildRdfList } from "@/helpers/rdfList.ts";
import { Plus } from "@/helpers/icons.tsx";
import { rdf, sh, shui } from "@/helpers/namespaces.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useRegisterContentLanguageSwitcherWidget } from "@/outputs/render/hooks/useRegisterContentLanguageSwitcherWidget.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import MemberShapeListItem from "@/outputs/render/modes/edit/MemberShapeListItem.tsx";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";

/**
 * Renders a sh:memberShape property's rdf:List as a reorderable list - the framework layer
 * between PropertyUIComponent and the widgets: it owns the list mechanics (order, add, remove)
 * but has no opinion on how any one item renders. Each item goes through WidgetSlot exactly like
 * an ordinary property value does, so any widget - a plain literal editor, DetailsEditor for an
 * object-shaped member (via sh:node plus an explicit shui:editor preference, same as anywhere
 * else in this codebase), or a future one - works automatically, with no branching here at all.
 */
export default function MemberShapeList({
  propertyUIElement,
  memberShapeNodes,
  labelledBy,
  autoFocusFirst,
}: {
  propertyUIElement: PropertyUIElement;
  memberShapeNodes: Term[];
  labelledBy: string;
  // True when this property is the first field of a nested form (DetailsEditor) that was itself
  // just added - see NodeUIElementChildren. A genuinely new nested node has no list items yet
  // (see `head`/`currentHead` below), so there's nothing to focus but the "Add item" button.
  autoFocusFirst?: boolean;
}) {
  const { activeLanguage } = useContentLanguage();
  // getObjects() for a memberShape property returns at most one term: the list's head. `head` is
  // undefined until the first item is ever added - there's nothing to write until then, so this
  // list starts out empty rather than eagerly materializing an rdf:nil triple.
  const [head] = useDataGraphObjects(propertyUIElement);
  const currentHead = head ?? rdf("nil");

  const cells = useReactiveRead(
    propertyUIElement.dataGraph,
    `member-shape-list@${currentHead.value}`,
    () => getRdfListCells(currentHead, propertyUIElement.dataGraph),
  );

  // One element for the whole list, not one per item - every item is governed by the same
  // memberShape(s), so its widget/default-object resolution only ever needs computing once.
  // focusNode is a placeholder never actually read: getObjects()/addObject()/etc. all no-op
  // without a sh:path, which a memberShape node never has - only .get() (via WidgetSlot) and
  // .getDefaultObject() (via addItem below) are used here, and neither needs a real path.
  const memberElement = useMemo(
    () =>
      new PropertyUIElement({
        shapesGraph: propertyUIElement.shapesGraph,
        dataGraph: propertyUIElement.dataGraph,
        scoresGraph: propertyUIElement.scoresGraph,
        widgetRegistry: propertyUIElement.widgetRegistry,
        focusNode: propertyUIElement.focusNode,
        propertyShapes: memberShapeNodes as NamedNode[],
      }),
    [propertyUIElement, memberShapeNodes],
  );

  // Resolved on memberElement's shape alone (no valueNode), same reasoning as
  // PropertyUIComponent's own registration - every item shares this one resolution regardless of
  // how many currently exist or are mid-async-default-resolution.
  const memberWidget = useWidget(shui("editor"), memberElement);
  useRegisterContentLanguageSwitcherWidget(Boolean(memberWidget?.meta?.needsLanguageSwitcher));

  const minListLength = propertyUIElement.get(sh("minListLength")) ?? 0;
  const maxListLength = propertyUIElement.get(sh("maxListLength")) ?? Infinity;
  const canRemove = cells.length > minListLength;
  const canAdd = cells.length < maxListLength;

  // Set only by the "Add item" button's own click (addItem below) - reset after every render once
  // it's been read into targetFocusIndex, so it can't leak into an unrelated later render (mirrors
  // PropertyUIComponentValues' own justClickedAddRef).
  const justClickedAddRef = useRef(false);
  useEffect(() => {
    justClickedAddRef.current = false;
  });
  const targetFocusIndex = justClickedAddRef.current ? cells.length - 1 : -1;
  // autoFocusFirst only ever arrives for a freshly-created, still-empty list (see the doc above) -
  // nothing in `cells` to focus yet, so the "Add item" button itself is the closest stand-in.
  const addButtonRef = useAutoFocusRef<HTMLButtonElement>(autoFocusFirst && cells.length === 0);

  // Every mutation rebuilds the list skeleton from scratch and swaps the property's value to the
  // fresh head - see rebuildRdfList - which is also what keeps this reactive for free: the
  // property's own tracked read (focusNode -> path -> head) changes on every commit, so
  // useDataGraphObjects above re-renders this component with the new `head` on its own.
  const commit = (values: Term[]) => {
    const newHead = rebuildRdfList(currentHead, values, propertyUIElement.dataGraph);
    if (head === undefined) propertyUIElement.addObject(newHead);
    else propertyUIElement.replaceObject(head, newHead);
  };

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cells.findIndex((entry) => entry.cell.value === active.id);
    const newIndex = cells.findIndex((entry) => entry.cell.value === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    commit(arrayMove(cells, oldIndex, newIndex).map((entry) => entry.value));
  };

  const addItem = async () => {
    const newObject = await memberElement.getDefaultObject(activeLanguage);
    if (newObject === undefined) return;
    justClickedAddRef.current = true;
    commit([...cells.map((entry) => entry.value), newObject]);
  };

  return (
    <div className="st-member-shape-list">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={cells.map((entry) => entry.cell.value)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="st-member-shape-list__items">
            {cells.map((entry, index) => (
              <MemberShapeListItem
                key={entry.cell.value}
                id={entry.cell.value}
                memberElement={memberElement}
                value={entry.value}
                labelledBy={labelledBy}
                canRemove={canRemove}
                onChange={(newValue) =>
                  commit(cells.map((c, i) => (i === index ? newValue : c.value)))
                }
                onRemove={() => commit(cells.filter((_, i) => i !== index).map((c) => c.value))}
                autoFocus={index === targetFocusIndex}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Localized id="member-shape-list-add-item" attrs={{ "aria-label": true }}>
        <button
          ref={addButtonRef}
          type="button"
          className="st-button st-member-shape-list__add"
          disabled={!canAdd}
          aria-label="Add item"
          onClick={addItem}
        >
          <Plus />
        </button>
      </Localized>
    </div>
  );
}
