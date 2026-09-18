import type { NamedNode } from "@rdfjs/types";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import {
  isUnsetPathNode,
  parsePathNode,
  type PropertyPath,
} from "@/structure/paths/parsePropertyPath.ts";
import { clearPropertyPath, writePropertyPath } from "@/structure/paths/writePropertyPath.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useState } from "react";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";
import { Localized } from "@fluent/react";
import { prefixedIri } from "@/helpers/prefixedIri.ts";
import { convertPathType, updateItem, withItemRemoved } from "./mutation-logic.tsx";
import AddPathButton from "./AddPathButton.tsx";
import PathItemModal from "./PathItemModal.tsx";
import { Plus } from "@/helpers/icons.tsx";

type UnaryWrapperType = "inverse" | "zeroOrMore" | "oneOrMore" | "zeroOrOne";

// InversePath/ZeroOrMorePath/OneOrMorePath/ZeroOrOnePath (see UnaryWrapperPath below) are
// otherwise identical - each just wraps a single nested PathNode behind its own icon/tooltip.
const UNARY_WRAPPER_CONFIG: Record<
  UnaryWrapperType,
  {
    wrapperClass: string;
    tooltipClass: string;
    iconClass: string;
    iconInnerClass: string;
    tooltipId: string;
    icon: string;
  }
> = {
  inverse: {
    wrapperClass: "st-inverse-path",
    tooltipClass: "st-inverse-tooltip",
    iconClass: "st-inverse-icon",
    iconInnerClass: "st-inverse-icon-inner",
    tooltipId: "property-path-editor-inverse-tooltip",
    icon: "^",
  },
  zeroOrMore: {
    wrapperClass: "st-zero-or-more-path",
    tooltipClass: "st-zero-or-more-tooltip",
    iconClass: "st-zero-or-more-icon",
    iconInnerClass: "st-zero-or-more-icon-inner",
    tooltipId: "property-path-editor-zero-or-more-tooltip",
    icon: "*",
  },
  oneOrMore: {
    wrapperClass: "st-one-or-more-path",
    tooltipClass: "st-one-or-more-tooltip",
    iconClass: "st-one-or-more-icon",
    iconInnerClass: "st-one-or-more-icon-inner",
    tooltipId: "property-path-editor-one-or-more-tooltip",
    icon: "+",
  },
  zeroOrOne: {
    wrapperClass: "st-zero-or-one-path",
    tooltipClass: "st-zero-or-one-tooltip",
    iconClass: "st-zero-or-one-icon",
    iconInnerClass: "st-zero-or-one-icon-inner",
    tooltipId: "property-path-editor-zero-or-one-tooltip",
    icon: "?",
  },
};

type OnPathChange = (newPath: PropertyPath) => void;
type PathNodeProps<T extends PropertyPath = PropertyPath> = {
  path: T;
  shape: PropertyUIElement;
  onChange: OnPathChange;
  // Removes *this exact node* from its nearest containing sequence/alternative - undefined when
  // there is no such container to remove it from (the root path itself, or a wrapper's own sole
  // inner path, e.g. zeroOrMore's wrapped content - see SequencePath/AlternativePath, the only two
  // places that ever produce one). The unary wrappers (Inverse/ZeroOrMore/OneOrMore/ZeroOrOne) just
  // forward whatever they received unchanged, since they don't add their own removal semantics.
  onRemove?: () => void;
};

export default function PropertyPathEditor({ shape, term, setTerm }: WidgetProps) {
  // Derived fresh from `term`/`dataGraph` on every render, not cached in local state: this
  // property can hold several sh:path values at once (see the showcase fixture, one row per
  // path-type), each rendered as its own PropertyPathEditor instance keyed by list index -
  // removing one row shifts every later index's `term` prop down by one, reusing the same React
  // instance for a *different* underlying value. A useState seeded only once at mount would keep
  // showing that instance's old value forever, since its initializer never re-runs on a later
  // prop change - the removal would then look like it dropped some other row entirely.
  // `null` for a freshly-minted value with nothing chosen yet (see meta.ts's own createTerm) -
  // parsePathNode would throw on that BlankNode, since the spec has no "empty path" concept.
  const path = isUnsetPathNode(term, shape.dataGraph) ? null : parsePathNode(term, shape.dataGraph);

  function handleChange(newPath: PropertyPath) {
    transact(shape.dataGraph, () => {
      clearPropertyPath(term, shape.dataGraph);
      setTerm(writePropertyPath(newPath, shape.dataGraph));
    });
  }

  function handleAdd(newItem: PropertyPath) {
    // Nothing chosen yet: the new item becomes the whole path, not a one-item sequence around it
    // (mirrors withItemRemoved's own collapse-to-single-item rule elsewhere in this file).
    if (path === null) {
      handleChange(newItem);
      return;
    }

    const sequence = convertPathType(path, "sequence") as Extract<
      PropertyPath,
      { type: "sequence" }
    >;
    handleChange({ ...sequence, items: [...sequence.items, newItem] });
  }

  return (
    <div className="st-property-path-editor">
      {path && <PathNode path={path} shape={shape} onChange={handleChange} />}

      <AddPathButton className="st-add-path" shape={shape} onAdd={handleAdd} />
    </div>
  );
}

function PathNode({ path, shape, onChange, onRemove }: PathNodeProps) {
  switch (path.type) {
    case "predicate":
      return <PredicatePath path={path} shape={shape} onChange={onChange} onRemove={onRemove} />;
    case "sequence":
      return <SequencePath path={path} shape={shape} onChange={onChange} />;
    case "alternative":
      return <AlternativePath path={path} shape={shape} onChange={onChange} />;
    case "inverse":
    case "zeroOrMore":
    case "oneOrMore":
    case "zeroOrOne":
      return <UnaryWrapperPath path={path} shape={shape} onChange={onChange} onRemove={onRemove} />;
  }
}

function PredicatePath({
  path,
  shape,
  onChange,
  onRemove,
}: PathNodeProps<Extract<PropertyPath, { type: "predicate" }>>) {
  return (
    <EditablePathLeaf
      shape={shape}
      displayPredicate={path.predicate}
      initialType="predicate"
      onChange={onChange}
      onRemove={onRemove}
    />
  );
}

type EditablePathLeafProps = {
  shape: PropertyUIElement;
  // What the modal opens pre-filled with - the predicate/type pair this exact click target
  // represents. For a bare PredicatePath this is just itself; for a unary wrapper directly
  // wrapping a bare predicate (see UnaryWrapperPath below), it's the *wrapper's* type - editing
  // must show the item's real current type, not the inner predicate's own always-"predicate" type.
  displayPredicate: NamedNode;
  initialType: PropertyPath["type"];
  onChange: OnPathChange;
  onRemove?: () => void;
};

// The clickable predicate box + its shared edit modal - used both by a bare predicate path node
// and by a unary wrapper that directly wraps one (see UnaryWrapperPath). `onChange` always
// replaces *this entire node* (the wrapper included, when there is one) with whatever Save
// builds, rather than re-wrapping the result - so picking a different path type in the modal
// swaps the wrapper instead of nesting a new one inside the existing one.
function EditablePathLeaf({
  shape,
  displayPredicate,
  initialType,
  onChange,
  onRemove,
}: EditablePathLeafProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="st-predicate-path"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {prefixedIri(displayPredicate) ?? displayPredicate.value}
      </div>
      <PathItemModal
        open={open}
        shape={shape}
        title={<Localized id="property-path-editor-edit-title">Edit path item</Localized>}
        initialPredicate={displayPredicate}
        initialType={initialType}
        onClose={() => setOpen(false)}
        onSave={(newItem) => {
          onChange(newItem);
          setOpen(false);
        }}
        onRemove={
          onRemove &&
          (() => {
            onRemove();
            setOpen(false);
          })
        }
      />
    </>
  );
}

function SequencePath({
  path,
  shape,
  onChange,
}: PathNodeProps<Extract<PropertyPath, { type: "sequence" }>>) {
  return (
    <div className="st-sequence-path">
      <div className="st-sequence-path-items">
        {path.items.map((item, index) => (
          <div key={index} className="st-sequence-path-item">
            <PathNode
              path={item}
              shape={shape}
              onChange={(newItem) =>
                onChange({ ...path, items: updateItem(path.items, index, newItem) })
              }
              onRemove={() => onChange(withItemRemoved(path, index))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AlternativePath({
  path,
  shape,
  onChange,
}: PathNodeProps<Extract<PropertyPath, { type: "alternative" }>>) {
  return (
    <>
      <div className="st-alternative-path" data-branches={path.items.length}>
        <div className="st-alternative-path-branches">
          {path.items.map((item, index) => (
            <div key={index} className="st-alternative-path-branch">
              <Tooltip
                className="st-alternative-tooltip"
                bare
                enabled
                tip={<Localized id="property-path-editor-alternative-tooltip" />}
              >
                <span className="st-alternative-icon st-path-type">
                  <span className="st-alternative-icon-inner">|</span>
                </span>
              </Tooltip>

              <PathNode
                path={item}
                shape={shape}
                onChange={(newItem) =>
                  onChange({ ...path, items: updateItem(path.items, index, newItem) })
                }
                onRemove={() => onChange(withItemRemoved(path, index))}
              />
              <AddPathButton
                className="st-add-path"
                shape={shape}
                onAdd={(newItem) => {
                  const sequence = convertPathType(item, "sequence") as Extract<
                    PropertyPath,
                    { type: "sequence" }
                  >;
                  const wrapped = { ...sequence, items: [...sequence.items, newItem] };
                  onChange({ ...path, items: updateItem(path.items, index, wrapped) });
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <AddPathButton
        shape={shape}
        className="st-alternative-path-add"
        onAdd={(newItem) => onChange({ ...path, items: [...path.items, newItem] })}
      >
        <Plus /> <Localized id="property-path-editor-alternative-add">alternative</Localized>
      </AddPathButton>
    </>
  );
}

function UnaryWrapperPath({
  path,
  shape,
  onChange,
  onRemove,
}: PathNodeProps<Extract<PropertyPath, { type: UnaryWrapperType }>>) {
  const config = UNARY_WRAPPER_CONFIG[path.type];

  return (
    <div className={config.wrapperClass}>
      <Tooltip
        className={config.tooltipClass}
        bare
        enabled
        tip={<Localized id={config.tooltipId} />}
      >
        <span className={`${config.iconClass} st-path-type`}>
          <span className={config.iconInnerClass}>{config.icon}</span>
        </span>
      </Tooltip>
      {path.path.type === "predicate" ? (
        // Directly wraps a bare predicate - the common case, and the only shape the edit modal's
        // single type dropdown can actually represent. Editing must show/replace *this* type
        // (e.g. "Zero or more"), not fall through to the inner predicate's own always-"predicate"
        // type - otherwise re-opening the form looks like the wrapper was never there, and
        // picking a new type from it would nest a second wrapper inside this one instead of
        // replacing it.
        <EditablePathLeaf
          shape={shape}
          displayPredicate={path.path.predicate}
          initialType={path.type}
          onChange={onChange}
          onRemove={onRemove}
        />
      ) : (
        <PathNode
          path={path.path}
          shape={shape}
          onChange={(newInner) => onChange({ ...path, path: newInner })}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}
