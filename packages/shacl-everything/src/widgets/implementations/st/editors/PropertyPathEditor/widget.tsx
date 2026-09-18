import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import { parsePathNode, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { clearPropertyPath, writePropertyPath } from "@/structure/paths/writePropertyPath.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useState } from "react";
import { Plus } from "@/helpers/icons.tsx";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";
import { Localized } from "@fluent/react";
import { prefixedIri } from "@/helpers/prefixedIri.ts";

type OnPathChange = (newPath: PropertyPath) => void;
type PathNodeProps<T extends PropertyPath = PropertyPath> = {
  path: T;
  shape: PropertyUIElement;
  onChange: OnPathChange;
};

export default function PropertyPathEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  const [path, setPath] = useState<PropertyPath | null>(parsePathNode(term, shape.dataGraph));

  function handleChange(newPath: PropertyPath) {
    transact(shape.dataGraph, () => {
      clearPropertyPath(term, shape.dataGraph);
      setTerm(writePropertyPath(newPath, shape.dataGraph));
    });
    setPath(newPath);
  }

  return (
    <div className="st-property-path-editor">
      {path && <PathNode path={path} shape={shape} onChange={handleChange} />}

      <button type="button" className="st-add-path" onClick={() => {}}>
        <Plus />
      </button>
    </div>
  );
}

function PathNode({ path, shape, onChange }: PathNodeProps) {
  switch (path.type) {
    case "predicate":
      return <PredicatePath path={path} shape={shape} onChange={onChange} />;
    case "sequence":
      return <SequencePath path={path} shape={shape} onChange={onChange} />;
    case "alternative":
      return <AlternativePath path={path} shape={shape} onChange={onChange} />;
    case "inverse":
      return <InversePath path={path} shape={shape} onChange={onChange} />;
    case "zeroOrMore":
      return <ZeroOrMorePath path={path} shape={shape} onChange={onChange} />;
    case "oneOrMore":
      return <OneOrMorePath path={path} shape={shape} onChange={onChange} />;
    case "zeroOrOne":
      return <ZeroOrOnePath path={path} shape={shape} onChange={onChange} />;
  }
}

function PredicatePath({
  path,
  shape,
  onChange,
}: PathNodeProps<Extract<PropertyPath, { type: "predicate" }>>) {
  return (
    <>
      <div className="st-predicate-path">{prefixedIri(path.predicate) ?? path.predicate.value}</div>
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
            <PathNode path={item} shape={shape} onChange={(newItem) => {}} />
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
    <div className="st-alternative-path" data-branches={path.items.length}>
      <div className="st-alternative-path-branches">
        {path.items.map((item, index) => (
          <div key={index} className="st-alternative-path-branch">
            <PathNode path={item} shape={shape} onChange={(newItem) => {}} />
            <button type="button" className="st-add-path" onClick={() => {}}>
              <Plus />
            </button>
            <Tooltip
              className="st-alternative-tooltip"
              bare
              enabled
              tip={<Localized id="property-path-editor-alternative-tooltip" />}
            >
              <span className="st-alternative-icon st-path-type">|</span>
            </Tooltip>
          </div>
        ))}
      </div>

      <button type="button" className="st-add-path st-alternative-path-add" onClick={() => {}}>
        <Plus />
      </button>
    </div>
  );
}

function InversePath({
  path,
  shape,
  onChange,
}: PathNodeProps<Extract<PropertyPath, { type: "inverse" }>>) {
  return (
    <div className="st-inverse-path">
      <Tooltip
        className="st-inverse-tooltip"
        bare
        enabled
        tip={<Localized id="property-path-editor-inverse-tooltip" />}
      >
        <span className="st-inverse-icon st-path-type">
          <span className="st-inverse-icon-inner">^</span>
        </span>
      </Tooltip>
      <PathNode
        path={path.path}
        shape={shape}
        onChange={(newInner) => onChange({ ...path, path: newInner })}
      />
    </div>
  );
}

function ZeroOrMorePath({
  path,
  shape,
  onChange,
}: PathNodeProps<Extract<PropertyPath, { type: "zeroOrMore" }>>) {
  return (
    <div className="st-zero-or-more-path">
      <Tooltip
        className="st-zero-or-more-tooltip"
        bare
        enabled
        tip={<Localized id="property-path-editor-zero-or-more-tooltip" />}
      >
        <span className="st-zero-or-more-icon st-path-type">
          <span className="st-zero-or-more-icon-inner">*</span>
        </span>
      </Tooltip>
      <PathNode
        path={path.path}
        shape={shape}
        onChange={(newInner) => onChange({ ...path, path: newInner })}
      />
    </div>
  );
}

function OneOrMorePath({
  path,
  shape,
  onChange,
}: PathNodeProps<Extract<PropertyPath, { type: "oneOrMore" }>>) {
  return (
    <div className="st-one-or-more-path">
      <Tooltip
        className="st-one-or-more-tooltip"
        bare
        enabled
        tip={<Localized id="property-path-editor-one-or-more-tooltip" />}
      >
        <span className="st-one-or-more-icon st-path-type">
          <span className="st-one-or-more-icon-inner">+</span>
        </span>
      </Tooltip>
      <PathNode
        path={path.path}
        shape={shape}
        onChange={(newInner) => onChange({ ...path, path: newInner })}
      />
    </div>
  );
}

function ZeroOrOnePath({
  path,
  shape,
  onChange,
}: PathNodeProps<Extract<PropertyPath, { type: "zeroOrOne" }>>) {
  return (
    <div className="st-zero-or-one-path">
      <Tooltip
        className="st-zero-or-one-tooltip"
        bare
        enabled
        tip="Zero or one (?) — this path is optional"
      >
        <span className="st-zero-or-one-icon st-path-type">
          <span className="st-zero-or-one-icon-inner">?</span>
        </span>
      </Tooltip>
      <PathNode
        path={path.path}
        shape={shape}
        onChange={(newInner) => onChange({ ...path, path: newInner })}
      />
    </div>
  );
}
