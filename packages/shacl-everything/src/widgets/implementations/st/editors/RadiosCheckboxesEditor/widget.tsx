import { useId, useMemo, useState } from "react";
import type { NamedNode, Term } from "@rdfjs/types";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { localName } from "@/helpers/localName.ts";
import { sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import { depictionRolePropertyPaths } from "@/resolution/label.ts";
import { shaclInstancesOfClass } from "@/resolution/targets.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

type ResolvedOption = { term: NamedNode; label?: string; depiction?: NamedNode };

export default function RadiosCheckboxesEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const shClasses = useMemo(() => shape.get(sh("class")), [shape]);
  // Mirrors SubClassEditor/meta.ts's singleUnifiedWidget: no sh:maxCount means unbounded, so only
  // an explicit maxCount of 1 rules out a second value ever existing for this property.
  const maxCount = shape.get(sh("maxCount")) ?? Infinity;
  const isMultiValued = maxCount !== 1;
  const inputType: "checkbox" | "radio" = isMultiValued ? "checkbox" : "radio";
  const groupName = useId();

  // Every existing local instance of this property's sh:class(es) - the same closed/already-known
  // vocabulary source EnumSelectEditor's own classOptions fallback uses, not a federated search.
  const options = useMemo(
    () =>
      dedupeTerms(
        shClasses.flatMap((shClass) =>
          shaclInstancesOfClass(shClass, shape.dataGraph, shape.shapesGraph),
        ),
      ).filter((option): option is NamedNode => option.termType === "NamedNode"),
    [shClasses, shape],
  );

  // Whether the value's node shape declares a shui:DepictionRole path at all - a shape-level
  // switch (checked once, not per option), so an option that happens to have no image of its own
  // still renders as an (empty) image tile rather than silently falling back to plain text rows -
  // see Tile below.
  const hasDepictionRole = useMemo(() => depictionRolePropertyPaths(shape).length > 0, [shape]);

  // One batched lookup for every option's LabelRole label (always) and DepictionRole image (used
  // only when hasDepictionRole) - see useOptionLookups, the same mechanism EnumSelectEditor's own
  // dropdown resolves its rows through, instead of one query per option.
  const lookups = useOptionLookups(shape, options);

  const resolved: ResolvedOption[] = options
    .map((option) => {
      const match = lookups.find((lookup) => lookup.iri.value === option.value);
      return { term: option, label: match?.label, depiction: match?.depiction };
    })
    .sort((a, b) =>
      a.label && b.label ? a.label.localeCompare(b.label) : a.term.value.localeCompare(b.term.value),
    );

  // singleUnifiedWidget (see meta.ts) means this is the property's only widget instance when
  // multi-valued - it owns the whole value set directly via `shape` (read here, written in
  // toggle() below) rather than the single term/setTerm pair every other widget is limited to.
  const selectedObjects = useDataGraphObjects(shape);

  const isChecked = (candidate: Term): boolean =>
    isMultiValued
      ? selectedObjects.some((object) => object.value === candidate.value)
      : candidate.value === term.value;

  const toggle = (candidate: NamedNode, checked: boolean) => {
    if (!isMultiValued) {
      setTerm(candidate);
      return;
    }
    if (checked) shape.addObject(candidate);
    else shape.removeObject(candidate);
  };

  return (
    <div
      className="st-radios-checkboxes"
      role={isMultiValued ? "group" : "radiogroup"}
      aria-labelledby={labelledBy}
      data-layout={hasDepictionRole ? "images" : "list"}
    >
      {resolved.map((option) => (
        <RadiosCheckboxesOption
          key={termKey(option.term)}
          option={option}
          inputType={inputType}
          groupName={inputType === "radio" ? groupName : undefined}
          checked={isChecked(option.term)}
          showImage={hasDepictionRole}
          onToggle={(checked) => toggle(option.term, checked)}
        />
      ))}
    </div>
  );
}

type OptionProps = {
  option: ResolvedOption;
  inputType: "checkbox" | "radio";
  groupName: string | undefined;
  checked: boolean;
  showImage: boolean;
  onToggle: (checked: boolean) => void;
};

// A per-option image can 404 independently of the others - hasError is therefore per-instance
// state, which is why this is its own component rather than inline JSX inside the map() above
// (mirrors AutoCompleteOption's own hasError/isDirectRenderable handling).
function RadiosCheckboxesOption({
  option,
  inputType,
  groupName,
  checked,
  showImage,
  onToggle,
}: OptionProps) {
  const [hasError, setHasError] = useState(false);
  const displayLabel = option.label ?? localName(option.term) ?? option.term.value;

  const input = (
    <input
      type={inputType}
      name={groupName}
      checked={checked}
      onChange={(event) => onToggle(event.target.checked)}
    />
  );

  if (!showImage) {
    return (
      <label className="st-radios-checkboxes__option">
        {input}
        {displayLabel}
      </label>
    );
  }

  const isDirectRenderable =
    option.depiction?.value.includes(".svg") || option.depiction?.value.includes("data:");

  return (
    <label className="st-radios-checkboxes__tile" data-checked={checked}>
      {input}
      {option.depiction && !hasError ? (
        <img
          loading="lazy"
          onError={() => setHasError(true)}
          className="st-radios-checkboxes__tile-depiction"
          src={
            isDirectRenderable
              ? option.depiction.value
              : `//wsrv.nl/?url=${encodeURIComponent(option.depiction.value)}&w=96&h=96&fit=cover`
          }
          alt=""
        />
      ) : (
        <span className="st-radios-checkboxes__tile-depiction st-radios-checkboxes__tile-depiction--empty" />
      )}
      <span className="st-radios-checkboxes__tile-label">{displayLabel}</span>
    </label>
  );
}
