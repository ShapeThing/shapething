import { Localized } from "@fluent/react";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";

const PATH_TYPE_ICON: Record<PropertyPath["type"], string> = {
  predicate: ".",
  sequence: "/",
  alternative: "|",
  inverse: "^",
  zeroOrMore: "*",
  oneOrMore: "+",
  zeroOrOne: "?",
};

const PATH_TYPE_TOOLTIP: Partial<Record<PropertyPath["type"], string>> = {
  alternative: "property-path-editor-alternative-tooltip",
  sequence: "property-path-editor-sequence-tooltip",
  inverse: "property-path-editor-inverse-tooltip",
  zeroOrMore: "property-path-editor-zero-or-more-tooltip",
  oneOrMore: "property-path-editor-one-or-more-tooltip",
  zeroOrOne: "property-path-editor-zero-or-one-tooltip",
};

// `tooltip={false}` where the icon sits next to its own label already, like in the type menu.
export default function PathTypeIcon({
  type,
  tooltip = true,
}: {
  type: PropertyPath["type"];
  tooltip?: boolean;
}) {
  const tooltipId = PATH_TYPE_TOOLTIP[type];
  const badge = (
    <div className={`st-path-type-icon st-path-type-icon-${type}`} aria-hidden={!tooltip}>
      <div className="st-path-type-icon-content">{PATH_TYPE_ICON[type]}</div>
    </div>
  );
  if (!tooltip || !tooltipId) return badge;
  return (
    <Tooltip bare enabled tip={<Localized id={tooltipId} />}>
      {badge}
    </Tooltip>
  );
}
