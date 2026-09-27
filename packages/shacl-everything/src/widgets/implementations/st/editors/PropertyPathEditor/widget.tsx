import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState,
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
  needsSecondItem,
  PATH_TYPES,
  withItemInserted,
  withItemRemoved,
  withItemReplaced,
  withStepAround,
  withType,
} from "./mutation-logic.ts";
import PredicateModal from "./PredicateModal.tsx";
import PathTypeMenu from "./PathTypeMenu.tsx";
import PathTypeIcon from "./PathTypeIcon.tsx";

// Every path node gets `onChange` to replace itself as a whole; the root turns that into a rewrite
// of the stored sh:path value. `onRemove` takes it out of its parent, which may then collapse too.
type PathProps<T extends PropertyPath = PropertyPath> = {
  path: T;
  onChange: (newPath: PropertyPath) => void;
  onRemove: () => void;
};

// Lets any add button, however deeply nested, open the one predicate modal the root renders.
const RequestPredicateContext = createContext<(onPick: (predicate: NamedNode) => void) => void>(
  () => {},
);

type TypeMenuRequest = {
  anchor: HTMLElement;
  x: number;
  y: number;
  path: PropertyPath;
  onChange: (newPath: PropertyPath) => void;
  onRemove: () => void;
};

// Lets any prefix/suffix open the one type menu the root renders.
const RequestTypeMenuContext = createContext<(request: TypeMenuRequest) => void>(() => {});

// Right-click (or the context-menu key / Shift+F10 on a focused prefix/suffix) opens the type
// menu. A keyboard-triggered contextmenu has no pointer position, so it opens under the element.
function useTypeMenu({ path, onChange, onRemove }: PathProps) {
  const requestTypeMenu = useContext(RequestTypeMenuContext);
  return (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    let { clientX: x, clientY: y } = event;
    if (x === 0 && y === 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      x = rect.left;
      y = rect.bottom;
    }
    requestTypeMenu({ anchor: event.currentTarget, x, y, path, onChange, onRemove });
  };
}

export default function PropertyPathEditor({ shape, term, setTerm }: WidgetProps) {
  // Read from dataGraph, where handleChange writes. `null` for a fresh, still-empty blank node
  // (see meta.ts), which parsePathNode would throw on.
  const path = useMemo(
    () => (isUnsetPathNode(term, shape.dataGraph) ? null : parsePathNode(term, shape.dataGraph)),
    [term, shape.dataGraph],
  );

  function handleChange(newPath: PropertyPath) {
    transact(shape.dataGraph, () => {
      clearPropertyPath(term, shape.dataGraph);
      setTerm(writePropertyPath(newPath, shape.dataGraph));
    });
  }

  // Back to the empty state: a fresh blank node without path triples (see meta.ts).
  function handleRemove() {
    transact(shape.dataGraph, () => {
      clearPropertyPath(term, shape.dataGraph);
      setTerm(factory.blankNode());
    });
  }

  // The add button that asked for a predicate, waiting for the modal's answer.
  // `initial` is set when editing an existing predicate rather than adding one.
  const [pendingPick, setPendingPick] = useState<{
    onPick: (predicate: NamedNode) => void;
    initial?: NamedNode;
  }>();
  const [typeMenu, setTypeMenu] = useState<TypeMenuRequest>();

  // The menu takes focus, so the element it was opened from is marked to keep its focus outline.
  useEffect(() => {
    const anchor = typeMenu?.anchor;
    if (!anchor) return;
    anchor.dataset.typeMenuOpen = "";
    return () => {
      delete anchor.dataset.typeMenuOpen;
    };
  }, [typeMenu]);

  return (
    <RequestPredicateContext.Provider value={(onPick) => setPendingPick({ onPick })}>
      <RequestTypeMenuContext.Provider value={setTypeMenu}>
        <div className="st-property-path-editor">
          {path ? (
            <>
              <AddButton onAdd={(item) => handleChange(withStepAround(path, item, "before"))} />
              <Path path={path} onChange={handleChange} onRemove={handleRemove} />
              <AddButton onAdd={(item) => handleChange(withStepAround(path, item, "after"))} />
            </>
          ) : (
            <AddButton onAdd={handleChange} />
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
                const { path, onChange } = typeMenu;
                if (!needsSecondItem(path, type)) return onChange(withType(path, type));
                // p to a sequence asks for the step after it, p to an alternative for a second branch.
                setPendingPick({
                  onPick: (predicate) =>
                    onChange(withType(path, type, { type: "predicate", predicate })),
                });
              }}
              onEdit={
                typeMenu.path.type === "predicate"
                  ? () => {
                      setTypeMenu(undefined);
                      const { path, onChange } = typeMenu;
                      setPendingPick({
                        initial: (path as Extract<PropertyPath, { type: "predicate" }>).predicate,
                        onPick: (predicate) => onChange({ type: "predicate", predicate }),
                      });
                    }
                  : undefined
              }
              onRemove={() => {
                setTypeMenu(undefined);
                typeMenu.onRemove();
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
      </RequestTypeMenuContext.Provider>
    </RequestPredicateContext.Provider>
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

// Asks for a predicate first; `onAdd` then gets the new step to insert at this button's position.
function AddButton({
  className,
  onAdd,
}: {
  className?: string;
  onAdd: (item: PropertyPath) => void;
}) {
  const requestPredicate = useContext(RequestPredicateContext);
  // preventDefault keeps focus on the focused segment/prefix/suffix, otherwise the mousedown
  // blurs it, which hides this very button before the click lands.
  return (
    <button
      type="button"
      className={`st-add-button ${className ?? ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => requestPredicate((predicate) => onAdd({ type: "predicate", predicate }))}
    >
      +
    </button>
  );
}

function PredicatePath(props: PathProps<Extract<PropertyPath, { type: "predicate" }>>) {
  const { path } = props;
  const openTypeMenu = useTypeMenu(props);
  return (
    <div className="st-predicate-path st-path-segment" tabIndex={0} onContextMenu={openTypeMenu}>
      <PrefixedIri term={path.predicate} />
    </div>
  );
}

// Each add button inserts a new step at its own position: right after the prefix is index 0,
// right after item i is index i + 1.
function SequencePath(props: PathProps<Extract<PropertyPath, { type: "sequence" }>>) {
  const { path, onChange } = props;
  const openTypeMenu = useTypeMenu(props);
  const insertAt = (index: number) => (item: PropertyPath) =>
    onChange(withItemInserted(path, index, item));
  return (
    <div className="st-sequence-path st-path-segment">
      <div className="st-sequence-path-prefix" tabIndex={0} onContextMenu={openTypeMenu}>
        <PathTypeIcon type="sequence" />
      </div>
      <AddButton onAdd={insertAt(0)} />
      {path.items.map((item, index) => (
        <Fragment key={index}>
          <Path
            path={item}
            onChange={(newItem) => onChange(withItemReplaced(path, index, newItem))}
            onRemove={() => onChange(withItemRemoved(path, index))}
          />
          <AddButton onAdd={insertAt(index + 1)} />
        </Fragment>
      ))}
      <div className="st-sequence-path-suffix" tabIndex={0} onContextMenu={openTypeMenu}></div>
    </div>
  );
}

// The alternative's own add button (positioned at its bottom) appends a branch. The buttons around
// each branch instead grow that one branch into a sequence, keeping the branch count the same.
function AlternativePath(props: PathProps<Extract<PropertyPath, { type: "alternative" }>>) {
  const { path, onChange } = props;
  const openTypeMenu = useTypeMenu(props);
  const replaceItem = (index: number, newItem: PropertyPath) =>
    onChange(withItemReplaced(path, index, newItem));
  return (
    <div className="st-alternative-path st-path-segment">
      <div className="st-alternative-path-prefix" tabIndex={0} onContextMenu={openTypeMenu}>
        <PathTypeIcon type="alternative" />
      </div>

      <div className="st-alternative-path-items">
        {path.items.map((item, index) => (
          <div className="st-alternative-path-item" key={index}>
            <AddButton
              onAdd={(newItem) => replaceItem(index, withStepAround(item, newItem, "before"))}
            />
            <Path
              path={item}
              onChange={(newItem) => replaceItem(index, newItem)}
              onRemove={() => onChange(withItemRemoved(path, index))}
            />
            <AddButton
              onAdd={(newItem) => replaceItem(index, withStepAround(item, newItem, "after"))}
            />
          </div>
        ))}
      </div>
      {/* After the items in the DOM so tab order reaches it after the last branch, which is also
          where it's positioned. */}
      <AddButton
        className="st-alternative-path-append-branch"
        onAdd={(item) => onChange(withItemInserted(path, path.items.length, item))}
      />
      <div className="st-alternative-path-suffix" tabIndex={0} onContextMenu={openTypeMenu}></div>
    </div>
  );
}

// Removing a wrapper's inner path removes the wrapper too, as it can't be empty.
// The add buttons inside a wrapper grow its wrapped path into a sequence, so the new step lands
// inside the wrapper (^p becomes ^(new/p)); the buttons outside it belong to the parent.
function wrappedAddHandlers<T extends Extract<PropertyPath, { path: PropertyPath }>>({
  path,
  onChange,
}: PathProps<T>) {
  return {
    addBefore: (item: PropertyPath) =>
      onChange({ ...path, path: withStepAround(path.path, item, "before") }),
    addAfter: (item: PropertyPath) =>
      onChange({ ...path, path: withStepAround(path.path, item, "after") }),
    onInnerChange: (newInner: PropertyPath) => onChange({ ...path, path: newInner }),
  };
}

function InversePath(props: PathProps<Extract<PropertyPath, { type: "inverse" }>>) {
  const { addBefore, addAfter, onInnerChange } = wrappedAddHandlers(props);
  const openTypeMenu = useTypeMenu(props);
  return (
    <div className="st-inverse-path st-path-segment">
      <div className="st-inverse-path-prefix" tabIndex={0} onContextMenu={openTypeMenu}>
        <PathTypeIcon type="inverse" />
      </div>
      <AddButton onAdd={addBefore} />
      <Path path={props.path.path} onChange={onInnerChange} onRemove={props.onRemove} />
      <AddButton onAdd={addAfter} />
      <div className="st-inverse-path-suffix" tabIndex={0} onContextMenu={openTypeMenu}></div>
    </div>
  );
}

function ZeroOrMorePath(props: PathProps<Extract<PropertyPath, { type: "zeroOrMore" }>>) {
  const { addBefore, addAfter, onInnerChange } = wrappedAddHandlers(props);
  const openTypeMenu = useTypeMenu(props);
  return (
    <div className="st-zero-or-more-path st-path-segment">
      <div className="st-zero-or-more-path-prefix" tabIndex={0} onContextMenu={openTypeMenu}>
        <PathTypeIcon type="zeroOrMore" />
      </div>

      <AddButton onAdd={addBefore} />
      <Path path={props.path.path} onChange={onInnerChange} onRemove={props.onRemove} />
      <AddButton onAdd={addAfter} />
      <div className="st-zero-or-more-path-suffix" tabIndex={0} onContextMenu={openTypeMenu}></div>
    </div>
  );
}

function OneOrMorePath(props: PathProps<Extract<PropertyPath, { type: "oneOrMore" }>>) {
  const { addBefore, addAfter, onInnerChange } = wrappedAddHandlers(props);
  const openTypeMenu = useTypeMenu(props);
  return (
    <div className="st-one-or-more-path st-path-segment">
      <div className="st-one-or-more-path-prefix" tabIndex={0} onContextMenu={openTypeMenu}>
        <PathTypeIcon type="oneOrMore" />
      </div>
      <AddButton onAdd={addBefore} />
      <Path path={props.path.path} onChange={onInnerChange} onRemove={props.onRemove} />
      <AddButton onAdd={addAfter} />
      <div className="st-one-or-more-path-suffix" tabIndex={0} onContextMenu={openTypeMenu}></div>
    </div>
  );
}

function ZeroOrOnePath(props: PathProps<Extract<PropertyPath, { type: "zeroOrOne" }>>) {
  const { addBefore, addAfter, onInnerChange } = wrappedAddHandlers(props);
  const openTypeMenu = useTypeMenu(props);
  return (
    <div className="st-zero-or-one-path st-path-segment">
      <div className="st-zero-or-one-path-prefix" tabIndex={0} onContextMenu={openTypeMenu}>
        <PathTypeIcon type="zeroOrOne" />
      </div>
      <AddButton onAdd={addBefore} />
      <Path path={props.path.path} onChange={onInnerChange} onRemove={props.onRemove} />
      <AddButton onAdd={addAfter} />
      <div className="st-zero-or-one-path-suffix" tabIndex={0} onContextMenu={openTypeMenu}></div>
    </div>
  );
}
