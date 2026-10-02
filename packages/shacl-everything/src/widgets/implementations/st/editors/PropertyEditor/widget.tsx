import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Localized, useLocalization } from "@fluent/react";
import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { clsx } from "clsx";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { factory } from "@/helpers/factory.ts";
import { freshIri } from "@/helpers/freshIri.ts";
import { Plus } from "@/helpers/icons.tsx";
import { rdf, sh, xsd } from "@/helpers/namespaces.ts";
import { createStagingGraph } from "@/helpers/stagingGraph.ts";
import { termKey } from "@/helpers/termKey.ts";
import { nestedNodeElement } from "@/outputs/render/hooks/useNestedNode.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import SortableRow from "@/outputs/render/modes/edit/SortableRow.tsx";
import { valueNodeShapes } from "@/resolution/label.ts";
import { shapesForClass, shapesTargetingNode } from "@/resolution/targets.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import DeleteGroupModal from "@/widgets/implementations/st/editors/PropertyEditor/DeleteGroupModal.tsx";
import DraftModal, {
  type Draft,
} from "@/widgets/implementations/st/editors/PropertyEditor/DraftModal.tsx";
import {
  displayName,
  useRowLabel,
} from "@/widgets/implementations/st/editors/PropertyEditor/labels.ts";
import {
  getProjection,
  moveIntoGroup,
  moveItem,
  nextOrder,
  readTree,
  removeChildrenOf,
  type TreeItem,
} from "@/widgets/implementations/st/editors/PropertyEditor/tree.ts";
import "./style.css";

// Pixels of sideways drag per nesting level - matches the indentation in style.css.
const INDENTATION_WIDTH = 24;
// Droppable ids of the unused groups, told apart from the tree rows' own sortable ids.
const UNUSED_GROUP = "unused-group:";

const measuring = { droppable: { strategy: MeasuringStrategy.Always } };

// An unused group only takes a drop the pointer is actually over - otherwise closestCenter would
// pull every drag near the bottom of the tree into whichever unused group is nearest.
const collisionDetection: CollisionDetection = (args) => {
  const isUnused = (id: string | number) => String(id).startsWith(UNUSED_GROUP);
  const overUnused = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => isUnused(container.id)),
  });
  if (overUnused.length) return overUnused;
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => !isUnused(container.id)),
  });
};

function KindChip({ kind }: { kind: TreeItem["kind"] }) {
  return (
    <span className="st-property-editor__chip">
      {kind === "group" ? (
        <Localized id="property-editor-group">Group</Localized>
      ) : (
        <Localized id="property-editor-property">Property</Localized>
      )}
    </span>
  );
}

// A row's framed name - a button opening it for editing, when it can be edited.
function RowName({
  name,
  onEdit,
  children,
}: {
  name: string;
  onEdit?: (name: string) => void;
  children: ReactNode;
}) {
  if (!onEdit) return <span className="st-property-editor__name">{children}</span>;
  return (
    <Localized id="property-editor-edit" attrs={{ "aria-label": true }} vars={{ label: name }}>
      <button
        type="button"
        className="st-property-editor__name"
        aria-label={`Edit ${name}`}
        onClick={() => onEdit(name)}
      >
        {children}
      </button>
    </Localized>
  );
}

function TreeRow({
  item,
  depth,
  dataGraph,
  onEdit,
}: {
  item: TreeItem;
  depth: number;
  dataGraph: RdfStore;
  onEdit?: (name: string) => void;
}) {
  const labels = useRowLabel(item.term, dataGraph);
  const name = displayName(item.term, labels);
  const groupLabel = item.kind === "group" ? name : labels.label;

  return (
    <SortableRow
      id={item.id}
      as="li"
      className={clsx("st-property-editor__row", `st-property-editor__row--${item.kind}`)}
      style={{ "--st-property-editor-depth": depth } as CSSProperties}
    >
      <div className="st-property-editor__row-body" data-depth={depth}>
        <RowName name={name} onEdit={onEdit}>
          {groupLabel && <span className="st-property-editor__label">{groupLabel}</span>}
          {item.kind === "property" && labels.path && (
            <code className="st-property-editor__path">{labels.path}</code>
          )}
          <KindChip kind={item.kind} />
        </RowName>
      </div>
    </SortableRow>
  );
}

function UnusedGroup({
  group,
  dataGraph,
  onEdit,
}: {
  group: Quad_Subject;
  dataGraph: RdfStore;
  onEdit?: (name: string) => void;
}) {
  const name = displayName(group, useRowLabel(group, dataGraph));
  const { setNodeRef, isOver } = useDroppable({
    id: `${UNUSED_GROUP}${termKey(group)}`,
    data: { group },
  });

  return (
    <div
      ref={setNodeRef}
      className="st-property-editor__unused-group"
      data-over={isOver || undefined}
    >
      <RowName name={name} onEdit={onEdit}>
        <span className="st-property-editor__label">{name}</span>
        <KindChip kind="group" />
      </RowName>
    </div>
  );
}

/**
 * st:PropertyEditor - edits a node shape's sh:property values as a tree: each property shape
 * nested under its sh:group, each group under its own sh:group, every level in sh:order - the
 * structure the node shape's form is rendered in. Dragging a row reorders it (sh:order) and,
 * dragged sideways, moves it in or out of a group (sh:group); dropping one on an unused group
 * starts using that group. A property shape or group opens in a modal to edit, against whichever
 * node shapes describe property shapes / groups (see editShapes below).
 */
export default function PropertyEditor({ shape }: WidgetProps) {
  const { dataGraph, shapesGraph } = shape;
  const { l10n } = useLocalization();
  const [draft, setDraft] = useState<Draft>();
  const [deleting, setDeleting] = useState<{ group: Quad_Subject; name: string }>();

  const tree = useReactiveRead(dataGraph, `property-editor@${termKey(shape.focusNode)}`, () =>
    readTree(shape.getObjects(), dataGraph, shapesGraph),
  );

  // The node shapes a property shape / group is edited against: whatever this property's own
  // sh:node/sh:class point at, then any shape targeting sh:PropertyShape / sh:PropertyGroup - a
  // sh:property value is a property shape by definition, whether or not it's typed as one.
  const propertyShapes = useMemo(
    () =>
      dedupeTerms([
        ...valueNodeShapes(shape),
        ...shapesForClass(sh("PropertyShape"), shapesGraph),
      ]) as Quad_Subject[],
    [shape, shapesGraph],
  );
  const groupShapes = useMemo(
    () => shapesForClass(sh("PropertyGroup"), shapesGraph),
    [shapesGraph],
  );

  const editShapes = (node: Quad_Subject, kind: TreeItem["kind"]) =>
    dedupeTerms([
      ...shapesTargetingNode(node, shapesGraph, dataGraph),
      ...(kind === "group" ? groupShapes : propertyShapes),
    ]) as Quad_Subject[];

  const openDraft = (
    node: Quad_Subject,
    nodeShapes: Quad_Subject[],
    title: Draft["title"],
    label: string,
    seed?: (store: RdfStore) => void,
    link?: () => void,
    remove?: Draft["remove"],
  ) => {
    const staging = createStagingGraph(dataGraph, seed);
    setDraft({
      title,
      // Only a new node is seeded.
      submitLabel: seed ? (
        <Localized id="property-editor-save">Save</Localized>
      ) : (
        <Localized id="node-ui-submit-update">Update</Localized>
      ),
      label,
      staging,
      node: nestedNodeElement(shape, node, { nodeShapes, dataGraph: staging.dataGraph }),
      // Content first, link last (see useCreateInPlace's commit).
      save: () => staging.commit(link),
      remove,
    });
  };

  const edit = (item: { term: Quad_Subject; kind: TreeItem["kind"] }) => (name: string) =>
    openDraft(
      item.term,
      editShapes(item.term, item.kind),
      <Localized id="property-editor-edit-title" vars={{ label: name }} elems={{ label: <em /> }}>
        <span>
          Edit <em>{name}</em>
        </span>
      </Localized>,
      name,
      undefined,
      undefined,
      // Removing a property only unlinks it from this shape; deleting a group asks first, since
      // the group itself goes, for every shape using it (see DeleteGroupModal).
      item.kind === "property"
        ? {
            label: <Localized id="property-editor-remove">Remove property</Localized>,
            run: () => shape.removeObject(item.term),
          }
        : {
            label: <Localized id="property-editor-delete-group">Delete group</Localized>,
            run: () => setDeleting({ group: item.term, name }),
          },
    );

  const addProperty = () => {
    const property = factory.blankNode();
    const order = nextOrder(
      tree.items.filter((item) => item.depth === 0).map((item) => item.term),
      dataGraph,
    );
    openDraft(
      property,
      propertyShapes,
      <Localized id="property-editor-new-property-title">New property</Localized>,
      l10n.getString("property-editor-new-property-title"),
      (store) =>
        store.addQuad(
          factory.quad(property, sh("order"), factory.literal(String(order), xsd("integer"))),
        ),
      () => shape.addObject(property),
    );
  };

  // A new group isn't linked to anything yet - it shows up under the unused groups, ready to drop
  // a property on. A random IRI (in shui:defaultNamespace, if configured), like useCreateInPlace's
  // new instances.
  const addGroup = () => {
    const group = freshIri(shape.shapesGraph);
    openDraft(
      group,
      groupShapes,
      <Localized id="property-editor-new-group-title">New group</Localized>,
      l10n.getString("property-editor-new-group-title"),
      (store) => store.addQuad(factory.quad(group, rdf("type"), sh("PropertyGroup"))),
    );
  };

  const [activeId, setActiveId] = useState<string>();
  const [overId, setOverId] = useState<string>();
  const [offsetLeft, setOffsetLeft] = useState(0);

  const rows = useMemo(
    () => (activeId ? removeChildrenOf(tree.items, activeId) : tree.items),
    [tree.items, activeId],
  );
  const projection =
    activeId && overId && !overId.startsWith(UNUSED_GROUP)
      ? getProjection(rows, activeId, overId, offsetLeft, INDENTATION_WIDTH)
      : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const resetDrag = () => {
    setActiveId(undefined);
    setOverId(undefined);
    setOffsetLeft(0);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    resetDrag();
    const activeItem = tree.items.find((item) => item.id === active.id);
    if (!over || !activeItem) return;

    const unusedGroup = over.data.current?.group as Quad_Subject | undefined;
    if (unusedGroup) {
      moveIntoGroup(activeItem.term, unusedGroup, dataGraph);
      return;
    }

    if (!projection) return;
    // Let go where it was picked up - nothing to write.
    if (over.id === active.id && projection.parentId === activeItem.parentId) return;
    moveItem(tree.items, activeItem.id, String(over.id), projection, dataGraph);
  };

  const canEditProperty = propertyShapes.length > 0;
  const canEditGroup = groupShapes.length > 0;

  return (
    <div className="st-property-editor">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={measuring}
        onDragStart={({ active }) => {
          setActiveId(String(active.id));
          setOverId(String(active.id));
        }}
        onDragMove={({ delta }) => setOffsetLeft(delta.x)}
        onDragOver={({ over }) => setOverId(over ? String(over.id) : undefined)}
        onDragEnd={onDragEnd}
        onDragCancel={resetDrag}
      >
        {rows.length > 0 ? (
          <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
            <ul className="st-property-editor__tree">
              {rows.map((item) => {
                const canEdit = item.kind === "group" ? canEditGroup : canEditProperty;
                return (
                  <TreeRow
                    key={item.id}
                    item={item}
                    depth={item.id === activeId && projection ? projection.depth : item.depth}
                    dataGraph={dataGraph}
                    onEdit={canEdit ? edit(item) : undefined}
                  />
                );
              })}
            </ul>
          </SortableContext>
        ) : (
          <p className="st-property-editor__empty">
            <Localized id="property-editor-empty">No properties yet.</Localized>
          </p>
        )}

        {tree.unusedGroups.length > 0 && (
          <section className="st-property-editor__unused">
            <header className="st-property-editor__unused-header">
              <span className="st-property-editor__unused-title">
                <Localized id="property-editor-unused-groups">Unused groups</Localized>
              </span>
              <span className="st-property-editor__unused-description">
                <Localized id="property-editor-unused-groups-description">
                  Groups this shape doesn't use yet. Drop a property or a group on one to start
                  using it.
                </Localized>
              </span>
            </header>
            <div className="st-property-editor__unused-list">
              {tree.unusedGroups.map((group) => (
                <UnusedGroup
                  key={termKey(group)}
                  group={group}
                  dataGraph={dataGraph}
                  onEdit={canEditGroup ? edit({ term: group, kind: "group" }) : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </DndContext>

      {(canEditProperty || canEditGroup) && (
        <footer className="st-property-editor__footer">
          {canEditGroup && (
            <button type="button" className="st-button" onClick={addGroup}>
              <Plus />
              <Localized id="property-editor-add-group">Add a group</Localized>
            </button>
          )}
          {canEditProperty && (
            <button type="button" className="st-button" onClick={addProperty}>
              <Plus />
              <Localized id="property-editor-add-property">Add a property</Localized>
            </button>
          )}
        </footer>
      )}

      {draft && <DraftModal draft={draft} onClose={() => setDraft(undefined)} />}
      {deleting && (
        <DeleteGroupModal
          group={deleting.group}
          name={deleting.name}
          shape={shape.focusNode}
          dataGraph={dataGraph}
          onClose={() => setDeleting(undefined)}
        />
      )}
    </div>
  );
}
