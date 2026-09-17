import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import { parsePathNode, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import type { NamedNode } from "@rdfjs/types";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import { useState, type ReactNode } from "react";

export default function PropertyPathEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  const [path, setPath] = useState<PropertyPath | null>(parsePathNode(term, shape.dataGraph));

  return <div className="st-property-path-editor">{path && <PathNode path={path} />}</div>;
}

function PathNode({ path }: { path: PropertyPath }) {
  switch (path.type) {
    case "predicate":
      return <PredicatePath path={path} />;
    case "sequence":
      return <SequencePath path={path} />;
    case "alternative":
      return <AlternativePath path={path} />;
    case "inverse":
      return <InversePath path={path} />;
    case "zeroOrMore":
      return <ZeroOrMorePath path={path} />;
    case "oneOrMore":
      return <OneOrMorePath path={path} />;
    case "zeroOrOne":
      return <ZeroOrOnePath path={path} />;
  }
}

const pathTypeOptions = [
  { value: "predicate", label: <>Predicate</> },
  { value: "sequence", label: <>Sequence</> },
  { value: "alternative", label: <>Alternative</> },
  { value: "inverse", label: <>Inverse</> },
  { value: "zeroOrMore", label: <>Zero or More</> },
  { value: "oneOrMore", label: <>One or More</> },
  { value: "zeroOrOne", label: <>Zero or One</> },
];

function ChangeType({ path }: { path: PropertyPath }) {
  return (
    <SelectListbox<{ value: string; label: ReactNode }>
      value={pathTypeOptions.find((option) => option.value === path.type) ?? pathTypeOptions[0]}
      options={pathTypeOptions}
      onChange={(newValue) => {
        console.log("Change type to:", newValue);
      }}
      renderTriggerContent={(selectedOption) => selectedOption.label}
      renderOption={(option) => option.label}
    />
  );
}

function PropertyAutoComplete({ predicate }: { predicate: NamedNode }) {
  return <div className="st-property-auto-complete">{predicate.value}</div>;
}

function PredicatePath({ path }: { path: Extract<PropertyPath, { type: "predicate" }> }) {
  return (
    <div className="st-predicate-path">
      <PropertyAutoComplete predicate={path.predicate} />
      <ChangeType path={path} />
    </div>
  );
}

function SequencePath({ path }: { path: Extract<PropertyPath, { type: "sequence" }> }) {
  return (
    <div className="st-sequence-path">
      {path.items.map((item, index) => (
        <PathNode key={index} path={item} />
      ))}
      <button
        type="button"
        className="st-button st-button-primary"
        onClick={() => console.log("Add sequence item")}
      >
        Add Item
      </button>
      <ChangeType path={path} />
    </div>
  );
}

function AlternativePath({ path }: { path: Extract<PropertyPath, { type: "alternative" }> }) {
  return (
    <div className="st-alternative-path">
      {path.items.map((item, index) => (
        <div key={index} className="st-alternative-path-branch">
          <PathNode path={item} />
        </div>
      ))}
      <ChangeType path={path} />
    </div>
  );
}

function InversePath({ path }: { path: Extract<PropertyPath, { type: "inverse" }> }) {
  return (
    <div className="st-inverse-path">
      <PathNode path={path.path} />
      <ChangeType path={path} />
    </div>
  );
}

function ZeroOrMorePath({ path }: { path: Extract<PropertyPath, { type: "zeroOrMore" }> }) {
  return (
    <div className="st-zero-or-more-path">
      <PathNode path={path.path} />
      <ChangeType path={path} />
    </div>
  );
}

function OneOrMorePath({ path }: { path: Extract<PropertyPath, { type: "oneOrMore" }> }) {
  return (
    <div className="st-one-or-more-path">
      <PathNode path={path.path} />
      <ChangeType path={path} />
    </div>
  );
}

function ZeroOrOnePath({ path }: { path: Extract<PropertyPath, { type: "zeroOrOne" }> }) {
  return (
    <div className="st-zero-or-one-path">
      <PathNode path={path.path} />
      <ChangeType path={path} />
    </div>
  );
}
