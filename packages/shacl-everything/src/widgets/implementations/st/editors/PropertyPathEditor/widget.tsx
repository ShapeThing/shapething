import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import { Fragment, useMemo } from "react";
import { parsePathNode, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { PrefixedIri } from "@/helpers/prefixedIri.tsx";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";
import { Localized } from "@fluent/react";

export default function PropertyPathEditor({ shape, term, setTerm }: WidgetProps) {
  const path = useMemo(() => parsePathNode(term, shape.shapesGraph), [term]);
  return (
    <div className="st-property-path-editor">
      <AddButton {...path} prepend />
      <Path {...path} />
      <AddButton {...path} />
    </div>
  );
}

function Path(path: PropertyPath) {
  switch (path.type) {
    case "predicate":
      return <PredicatePath {...path} />;
    case "sequence":
      return <SequencePath {...path} />;
    case "alternative":
      return <AlternativePath {...path} />;
    case "inverse":
      return <InversePath {...path} />;
    case "zeroOrMore":
      return <ZeroOrMorePath {...path} />;
    case "oneOrMore":
      return <OneOrMorePath {...path} />;
    case "zeroOrOne":
      return <ZeroOrOnePath {...path} />;
    default:
      return null;
  }
}

function AddButton(path: PropertyPath & { prepend?: boolean }) {
  return <button className="st-add-button">+</button>;
}

const PATH_TYPE_TOOLTIP: Partial<Record<PropertyPath["type"], string>> = {
  alternative: "property-path-editor-alternative-tooltip",
  sequence: "property-path-editor-sequence-tooltip",
  inverse: "property-path-editor-inverse-tooltip",
  zeroOrMore: "property-path-editor-zero-or-more-tooltip",
  oneOrMore: "property-path-editor-one-or-more-tooltip",
  zeroOrOne: "property-path-editor-zero-or-one-tooltip",
};

function PathTypeIcon({ type }: { type: PropertyPath["type"] }) {
  let icon;

  switch (type) {
    case "predicate":
      icon = ".";
      break;
    case "sequence":
      icon = "/";
      break;
    case "alternative":
      icon = "|";
      break;
    case "inverse":
      icon = "^";
      break;
    case "zeroOrMore":
      icon = "*";
      break;
    case "oneOrMore":
      icon = "+";
      break;
    case "zeroOrOne":
      icon = "?";
      break;
    default:
      icon = null;
  }
  const tooltipId = PATH_TYPE_TOOLTIP[type];
  const badge = (
    <div className={`st-path-type-icon st-path-type-icon-${type}`}>
      <div className="st-path-type-icon-content">{icon}</div>
    </div>
  );
  if (!tooltipId) return badge;
  return (
    <Tooltip bare enabled tip={<Localized id={tooltipId} />}>
      {badge}
    </Tooltip>
  );
}

function PredicatePath(path: Extract<PropertyPath, { type: "predicate" }>) {
  return (
    <div className="st-predicate-path st-path-segment">
      <PrefixedIri term={path.predicate} />
    </div>
  );
}

function SequencePath(path: Extract<PropertyPath, { type: "sequence" }>) {
  return (
    <div className="st-sequence-path st-path-segment">
      <div className="st-sequence-path-prefix">
        <PathTypeIcon type="sequence" />
      </div>
      <AddButton {...path} />
      {path.items.map((item, index) => (
        <Fragment key={index}>
          <Path {...item} />
          <AddButton {...path} />
        </Fragment>
      ))}
      <div className="st-sequence-path-suffix"></div>
    </div>
  );
}

function AlternativePath(path: Extract<PropertyPath, { type: "alternative" }>) {
  return (
    <div className="st-alternative-path st-path-segment">
      <AddButton {...path} />
      <div className="st-alternative-path-prefix">
        <PathTypeIcon type="alternative" />
      </div>

      <div className="st-alternative-path-items">
        {path.items.map((item, index) => (
          <div className="st-alternative-path-item" key={index}>
            <AddButton {...path} />
            <Path {...item} />
            <AddButton {...path} />
          </div>
        ))}
      </div>
      <div className="st-alternative-path-suffix"></div>
    </div>
  );
}

function InversePath(path: Extract<PropertyPath, { type: "inverse" }>) {
  return (
    <div className="st-inverse-path st-path-segment">
      <div className="st-inverse-path-prefix">
        <PathTypeIcon type="inverse" />
      </div>
      <AddButton {...path} />
      <Path {...path.path} />
      <AddButton {...path} />
      <div className="st-inverse-path-suffix"></div>
    </div>
  );
}

function ZeroOrMorePath(path: Extract<PropertyPath, { type: "zeroOrMore" }>) {
  return (
    <div className="st-zero-or-more-path st-path-segment">
      <div className="st-zero-or-more-path-prefix">
        <PathTypeIcon type="zeroOrMore" />
      </div>

      <AddButton {...path} />
      <Path {...path.path} />
      <AddButton {...path} />
      <div className="st-zero-or-more-path-suffix"></div>
    </div>
  );
}

function OneOrMorePath(path: Extract<PropertyPath, { type: "oneOrMore" }>) {
  return (
    <div className="st-one-or-more-path st-path-segment">
      <div className="st-one-or-more-path-prefix">
        <PathTypeIcon type="oneOrMore" />
      </div>
      <AddButton {...path} />
      <Path {...path.path} />
      <AddButton {...path} />
      <div className="st-one-or-more-path-suffix"></div>
    </div>
  );
}

function ZeroOrOnePath(path: Extract<PropertyPath, { type: "zeroOrOne" }>) {
  return (
    <div className="st-zero-or-one-path st-path-segment">
      <div className="st-zero-or-one-path-prefix">
        <PathTypeIcon type="zeroOrOne" />
      </div>
      <AddButton {...path} />
      <Path {...path.path} />
      <AddButton {...path} />
      <div className="st-zero-or-one-path-suffix"></div>
    </div>
  );
}
