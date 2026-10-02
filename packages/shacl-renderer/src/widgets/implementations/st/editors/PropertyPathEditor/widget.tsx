import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import type { NamedNode } from "@rdfjs/types";
import {
  isUnsetPathNode,
  parsePathNode,
  type PropertyPath,
} from "@/structure/paths/parsePropertyPath.ts";
import { clearPropertyPath, writePropertyPath } from "@/structure/paths/writePropertyPath.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { PrefixedIri } from "@/helpers/prefixedIri.tsx";
import { factory } from "@/helpers/factory.ts";
import {
  canSwitchTo,
  isWithin,
  needsSecondItem,
  PATH_TYPES,
  removeAt,
  updateAt,
  withItemInserted,
  withInsertedBeside,
  withMoved,
  withStepAround,
  withType,
  type Location,
} from "./mutation-logic.ts";
import PredicateModal from "./PredicateModal.tsx";
import PathTypeMenu from "./PathTypeMenu.tsx";
import PathTypeIcon from "./PathTypeIcon.tsx";

// Every path node knows where it sits in the tree; all edits go through the root's `commit` as a
// rewrite of the whole tree, so an edit touching two places (a move) is still one write.
type PathProps<T extends PropertyPath = PropertyPath> = {
  path: T;
  location: Location;
};

// How an add button inserts `item` into the node at its `at` location (`null` for an empty root).
type Insert = (target: PropertyPath | null, item: PropertyPath) => PropertyPath;

type TypeMenuRequest = {
  anchor: HTMLElement;
  x: number;
  y: number;
  path: PropertyPath;
  location: Location;
};

type DropTarget = { location: Location; side: "before" | "after" };

type Editor = {
  commit: (update: (root: PropertyPath | null) => PropertyPath | null) => void;
  requestPredicate: (onPick: (predicate: NamedNode) => void) => void;
  requestTypeMenu: (request: TypeMenuRequest) => void;
  // The node being dragged, if any, and where it would land when dropped now.
  dragging: Location | undefined;
  setDragging: (location: Location | undefined) => void;
  dropTarget: DropTarget | undefined;
  setDropTarget: (target: DropTarget | undefined) => void;
};

const EditorContext = createContext<Editor>(null!);

function slotUpdate(at: Location, insert: Insert, item: PropertyPath) {
  return (root: PropertyPath | null) =>
    root && at.length > 0
      ? updateAt(root, at, (target) => insert(target, item))
      : insert(root, item);
}

// Right-click (or the context-menu key / Shift+F10 on a focused prefix/suffix) opens the type
// menu. A keyboard-triggered contextmenu has no pointer position, so it opens under the element.
// Dragging the same elements moves the whole node, previewed as its whole segment.
function useNodeHandles({ path, location }: PathProps) {
  const { requestTypeMenu, setDragging, setDropTarget } = useContext(EditorContext);
  return {
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      let { clientX: x, clientY: y } = event;
      if (x === 0 && y === 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left;
        y = rect.bottom;
      }
      requestTypeMenu({ anchor: event.currentTarget, x, y, path, location });
    },
    draggable: true,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      event.stopPropagation();
      const segment = event.currentTarget.closest<HTMLElement>(".st-path-segment")!;
      const rect = segment.getBoundingClientRect();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "text/plain",
        path.type === "predicate" ? path.predicate.value : "",
      );
      event.dataTransfer.setDragImage(segment, event.clientX - rect.left, event.clientY - rect.top);
      segment.dataset.dragSource = "";
      // Revealing the drop targets re-renders the editor, which Chrome answers by cancelling a drag
      // whose DOM changes during dragstart itself.
      setTimeout(() => setDragging(location));
    },
    onDragEnd: (event: DragEvent<HTMLElement>) => {
      const segment = event.currentTarget.closest<HTMLElement>(".st-path-segment");
      if (segment) delete segment.dataset.dragSource;
      setDragging(undefined);
      setDropTarget(undefined);
    },
  };
}

const sameLocation = (a: Location, b: Location) =>
  a.length === b.length && a.every((step, i) => step === b[i]);

// Every segment is a drop target for any node outside it: the pointer's half of it picks the side
// the dragged node lands on, as its sibling (see withInsertedBeside). Branches of an alternative
// are stacked, so there it's the top or bottom half. Nested segments each handle dragover, so
// stopping propagation makes the innermost one under the pointer the target.
function useDropTarget(location: Location) {
  const { commit, dragging, setDragging, dropTarget, setDropTarget } = useContext(EditorContext);
  const isTarget = dropTarget && sameLocation(dropTarget.location, location);
  return {
    "data-drop-side": isTarget ? dropTarget.side : undefined,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!dragging) return;
      event.stopPropagation();
      // Over the dragged node itself: nowhere to land, rather than beside whatever contains it.
      if (isWithin(location, dragging)) {
        if (dropTarget) setDropTarget(undefined);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      const stacked = event.currentTarget.parentElement?.classList.contains(
        "st-alternative-path-item",
      );
      const before = stacked
        ? event.clientY < rect.top + rect.height / 2
        : event.clientX < rect.left + rect.width / 2;
      const side = before ? "before" : "after";
      if (!isTarget || dropTarget.side !== side) setDropTarget({ location, side });
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!dragging || !isTarget) return;
      event.preventDefault();
      event.stopPropagation();
      const from = dragging;
      const { side } = dropTarget;
      setDragging(undefined);
      setDropTarget(undefined);
      commit((root) =>
        withMoved(root!, from, (tree, item) => withInsertedBeside(tree, location, side, item)),
      );
    },
  };
}

export default function PropertyPathEditor({ shape, term, setTerm }: WidgetProps) {
  // Read from dataGraph, where commit writes. `null` for a fresh, still-empty blank node
  // (see meta.ts), which parsePathNode would throw on.
  const path = useMemo(
    () => (isUnsetPathNode(term, shape.dataGraph) ? null : parsePathNode(term, shape.dataGraph)),
    [term, shape.dataGraph],
  );

  // Read through refs, as commit also runs from the modal and menu callbacks, created on an
  // earlier render.
  const latest = useRef({ path, term });
  latest.current = { path, term };

  // A `null` result goes back to the empty state: a fresh blank node without path triples.
  function commit(update: (root: PropertyPath | null) => PropertyPath | null) {
    const { path, term } = latest.current;
    const next = update(path);
    transact(shape.dataGraph, () => {
      clearPropertyPath(term, shape.dataGraph);
      setTerm(next ? writePropertyPath(next, shape.dataGraph) : factory.blankNode());
    });
  }

  // The add button that asked for a predicate, waiting for the modal's answer.
  // `initial` is set when editing an existing predicate rather than adding one.
  const [pendingPick, setPendingPick] = useState<{
    onPick: (predicate: NamedNode) => void;
    initial?: NamedNode;
  }>();
  const [typeMenu, setTypeMenu] = useState<TypeMenuRequest>();
  const [dragging, setDragging] = useState<Location>();
  const [dropTarget, setDropTarget] = useState<DropTarget>();

  // The menu takes focus, so the element it was opened from is marked to keep its focus outline.
  useEffect(() => {
    const anchor = typeMenu?.anchor;
    if (!anchor) return;
    anchor.dataset.typeMenuOpen = "";
    return () => {
      delete anchor.dataset.typeMenuOpen;
    };
  }, [typeMenu]);

  const editor: Editor = {
    commit,
    requestPredicate: (onPick) => setPendingPick({ onPick }),
    requestTypeMenu: setTypeMenu,
    dragging,
    setDragging,
    dropTarget,
    setDropTarget,
  };

  const replaceAt = (location: Location, node: PropertyPath) =>
    commit((root) => updateAt(root!, location, () => node));

  return (
    <EditorContext.Provider value={editor}>
      <div
        className="st-property-path-editor"
        data-dragging={dragging ? "" : undefined}
        // Off every segment (between them, the editor's padding) there's nowhere to land.
        onDragOver={() => dropTarget && setDropTarget(undefined)}
      >
        {path ? (
          <>
            <AddButton
              at={[]}
              insert={(root, item) => (root ? withStepAround(root, item, "before") : item)}
            />
            <Path path={path} location={[]} />
            <AddButton
              at={[]}
              insert={(root, item) => (root ? withStepAround(root, item, "after") : item)}
            />
          </>
        ) : (
          <AddButton at={[]} insert={(_, item) => item} />
        )}
        {/* Inside the editor so it inherits the type colour tokens; as a popover it still
            escapes this div's overflow. */}
        {typeMenu && (
          <PathTypeMenu
            x={typeMenu.x}
            y={typeMenu.y}
            current={typeMenu.path.type}
            disabled={PATH_TYPES.filter((type) => !canSwitchTo(typeMenu.path, type))}
            onClose={(restoreFocus) => {
              setTypeMenu(undefined);
              if (restoreFocus) typeMenu.anchor.focus();
            }}
            onPick={(type) => {
              setTypeMenu(undefined);
              const { path, location } = typeMenu;
              if (!needsSecondItem(path, type)) return replaceAt(location, withType(path, type));
              // p to a sequence asks for the step after it, p to an alternative for a second branch.
              setPendingPick({
                onPick: (predicate) =>
                  replaceAt(location, withType(path, type, { type: "predicate", predicate })),
              });
            }}
            onEdit={
              typeMenu.path.type === "predicate"
                ? () => {
                    setTypeMenu(undefined);
                    const { path, location } = typeMenu;
                    setPendingPick({
                      initial: (path as Extract<PropertyPath, { type: "predicate" }>).predicate,
                      onPick: (predicate) => replaceAt(location, { type: "predicate", predicate }),
                    });
                  }
                : undefined
            }
            onRemove={() => {
              setTypeMenu(undefined);
              commit((root) => removeAt(root!, typeMenu.location));
            }}
          />
        )}
      </div>
      {pendingPick && (
        <PredicateModal
          shape={shape}
          initial={pendingPick.initial}
          onClose={() => setPendingPick(undefined)}
          onPick={(predicate) => {
            setPendingPick(undefined);
            pendingPick.onPick(predicate);
          }}
        />
      )}
    </EditorContext.Provider>
  );
}

function Path(props: PathProps) {
  const { path } = props;
  switch (path.type) {
    case "predicate":
      return <PredicatePath {...props} path={path} />;
    case "sequence":
      return <SequencePath {...props} path={path} />;
    case "alternative":
      return <AlternativePath {...props} path={path} />;
    case "inverse":
      return <InversePath {...props} path={path} />;
    case "zeroOrMore":
      return <ZeroOrMorePath {...props} path={path} />;
    case "oneOrMore":
      return <OneOrMorePath {...props} path={path} />;
    case "zeroOrOne":
      return <ZeroOrOnePath {...props} path={path} />;
    default:
      return null;
  }
}

// Asks for a predicate, then inserts it at this button's position.
function AddButton({
  className,
  at,
  insert,
}: {
  className?: string;
  at: Location;
  insert: Insert;
}) {
  const { commit, requestPredicate } = useContext(EditorContext);
  // preventDefault keeps focus on the focused segment/prefix/suffix, otherwise the mousedown
  // blurs it, which hides this very button before the click lands.
  return (
    <button
      type="button"
      className={`st-add-button ${className ?? ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() =>
        requestPredicate((predicate) =>
          commit(slotUpdate(at, insert, { type: "predicate", predicate })),
        )
      }
    >
      +
    </button>
  );
}

function PredicatePath(props: PathProps<Extract<PropertyPath, { type: "predicate" }>>) {
  const { path } = props;
  const handles = useNodeHandles(props);
  const dropTarget = useDropTarget(props.location);
  return (
    <div className="st-predicate-path st-path-segment" tabIndex={0} {...handles} {...dropTarget}>
      <PrefixedIri term={path.predicate} />
    </div>
  );
}

// Each add button inserts a new step at its own position: right after the prefix is index 0,
// right after item i is index i + 1.
function SequencePath(props: PathProps<Extract<PropertyPath, { type: "sequence" }>>) {
  const { path, location } = props;
  const handles = useNodeHandles(props);
  const dropTarget = useDropTarget(props.location);
  const insertAt =
    (index: number): Insert =>
    (sequence, item) =>
      withItemInserted(sequence as typeof path, index, item);
  return (
    <div className="st-sequence-path st-path-segment" {...dropTarget}>
      <div className="st-sequence-path-prefix" tabIndex={0} {...handles}>
        <PathTypeIcon type="sequence" />
      </div>
      <AddButton at={location} insert={insertAt(0)} />
      {path.items.map((item, index) => (
        <Fragment key={index}>
          <Path path={item} location={[...location, index]} />
          <AddButton at={location} insert={insertAt(index + 1)} />
        </Fragment>
      ))}
      <div className="st-sequence-path-suffix" tabIndex={0} {...handles}></div>
    </div>
  );
}

// The alternative's own add button (positioned at its bottom) appends a branch. The buttons around
// each branch instead grow that one branch into a sequence, keeping the branch count the same.
function AlternativePath(props: PathProps<Extract<PropertyPath, { type: "alternative" }>>) {
  const { path, location } = props;
  const handles = useNodeHandles(props);
  const dropTarget = useDropTarget(props.location);
  return (
    <div className="st-alternative-path st-path-segment" {...dropTarget}>
      <div className="st-alternative-path-prefix" tabIndex={0} {...handles}>
        <PathTypeIcon type="alternative" />
      </div>

      <div className="st-alternative-path-items">
        {path.items.map((item, index) => (
          <div className="st-alternative-path-item" key={index}>
            <AddButton
              at={[...location, index]}
              insert={(branch, newItem) => withStepAround(branch!, newItem, "before")}
            />
            <Path path={item} location={[...location, index]} />
            <AddButton
              at={[...location, index]}
              insert={(branch, newItem) => withStepAround(branch!, newItem, "after")}
            />
          </div>
        ))}
      </div>
      {/* After the items in the DOM so tab order reaches it after the last branch, which is also
          where it's positioned. */}
      <AddButton
        className="st-alternative-path-append-branch"
        at={location}
        insert={(alternative, item) => {
          const { items } = alternative as typeof path;
          return withItemInserted(alternative as typeof path, items.length, item);
        }}
      />
      <div className="st-alternative-path-suffix" tabIndex={0} {...handles}></div>
    </div>
  );
}

// The add buttons inside a wrapper grow its wrapped path into a sequence, so the new step lands
// inside the wrapper (^p becomes ^(new/p)); the buttons outside it belong to the parent.
function WrappedInner({
  path,
  location,
}: PathProps<Extract<PropertyPath, { path: PropertyPath }>>) {
  const inner = [...location, "path"] as Location;
  return (
    <>
      <AddButton at={inner} insert={(target, item) => withStepAround(target!, item, "before")} />
      <Path path={path.path} location={inner} />
      <AddButton at={inner} insert={(target, item) => withStepAround(target!, item, "after")} />
    </>
  );
}

function InversePath(props: PathProps<Extract<PropertyPath, { type: "inverse" }>>) {
  const handles = useNodeHandles(props);
  const dropTarget = useDropTarget(props.location);
  return (
    <div className="st-inverse-path st-path-segment" {...dropTarget}>
      <div className="st-inverse-path-prefix" tabIndex={0} {...handles}>
        <PathTypeIcon type="inverse" />
      </div>
      <WrappedInner {...props} />
      <div className="st-inverse-path-suffix" tabIndex={0} {...handles}></div>
    </div>
  );
}

function ZeroOrMorePath(props: PathProps<Extract<PropertyPath, { type: "zeroOrMore" }>>) {
  const handles = useNodeHandles(props);
  const dropTarget = useDropTarget(props.location);
  return (
    <div className="st-zero-or-more-path st-path-segment" {...dropTarget}>
      <div className="st-zero-or-more-path-prefix" tabIndex={0} {...handles}>
        <PathTypeIcon type="zeroOrMore" />
      </div>
      <WrappedInner {...props} />
      <div className="st-zero-or-more-path-suffix" tabIndex={0} {...handles}></div>
    </div>
  );
}

function OneOrMorePath(props: PathProps<Extract<PropertyPath, { type: "oneOrMore" }>>) {
  const handles = useNodeHandles(props);
  const dropTarget = useDropTarget(props.location);
  return (
    <div className="st-one-or-more-path st-path-segment" {...dropTarget}>
      <div className="st-one-or-more-path-prefix" tabIndex={0} {...handles}>
        <PathTypeIcon type="oneOrMore" />
      </div>
      <WrappedInner {...props} />
      <div className="st-one-or-more-path-suffix" tabIndex={0} {...handles}></div>
    </div>
  );
}

function ZeroOrOnePath(props: PathProps<Extract<PropertyPath, { type: "zeroOrOne" }>>) {
  const handles = useNodeHandles(props);
  const dropTarget = useDropTarget(props.location);
  return (
    <div className="st-zero-or-one-path st-path-segment" {...dropTarget}>
      <div className="st-zero-or-one-path-prefix" tabIndex={0} {...handles}>
        <PathTypeIcon type="zeroOrOne" />
      </div>
      <WrappedInner {...props} />
      <div className="st-zero-or-one-path-suffix" tabIndex={0} {...handles}></div>
    </div>
  );
}
