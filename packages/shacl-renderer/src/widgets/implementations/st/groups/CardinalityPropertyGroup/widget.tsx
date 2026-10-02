import { useEffect, useId, useState } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { Chevron } from "@/helpers/icons.tsx";
import { sh, xsd } from "@/helpers/namespaces.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { termKey } from "@/helpers/termKey.ts";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import EditUIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import ViewUIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import "./style.css";

type Write = readonly [PropertyUIElement | undefined, number | undefined];

function childWithPath(group: GroupUIElement, predicate: NamedNode): PropertyUIElement | undefined {
  return group.children.find((child): child is PropertyUIElement => {
    if (child.kind !== "property") return false;
    const path = child.propertyPath();
    return path?.type === "predicate" && path.predicate.equals(predicate);
  });
}

function readCount(property: PropertyUIElement | undefined): number | undefined {
  const value = property?.getObjects()[0]?.value;
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

// No value or a 1 is what the two checkboxes already express - anything else only shows up in the
// advanced fields, so those have to be visible.
const isPlain = (count: number | undefined) => count === undefined || count === 1;

/**
 * Groups a meta shape's sh:minCount and sh:maxCount properties into "Required" / "Multiple"
 * checkboxes, with the two properties themselves - rendered as usual, with their own widgets and
 * validation - in a collapsible "Advanced" section below. The section starts open whenever the
 * counts say more than the checkboxes can.
 *
 * The checkboxes write through the two child properties, so this group only works out which child
 * is which; every other child of the group renders in the advanced section as-is.
 */
export default function CardinalityPropertyGroup({ group }: GroupWidgetProps) {
  const { mode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const label = group.label([activeInterfaceLanguage]);
  const description = group.description([activeInterfaceLanguage]);
  const labelId = useId();

  const minProperty = childWithPath(group, sh("minCount"));
  const maxProperty = childWithPath(group, sh("maxCount"));

  const { min, max } = useReactiveRead(
    group.dataGraph,
    `cardinality-property-group@${termKey(group.focusNode)}`,
    () => ({ min: readCount(minProperty), max: readCount(maxProperty) }),
  );

  const hasAdvancedValues = !isPlain(min) || !isPlain(max);
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedValues);
  // Also opens when such a value arrives from elsewhere - typed into the advanced fields' own
  // widgets is covered by the section already being open, but an undo isn't.
  useEffect(() => {
    if (hasAdvancedValues) setAdvancedOpen(true);
  }, [hasAdvancedValues]);

  if (mode === "view") {
    return (
      <FormElement label={label} className="st-cardinality-property-group" dataId={group.node.value}>
        <ViewUIElementChildren elements={group.children} />
      </FormElement>
    );
  }

  // All writes of one gesture go into one transaction, so they undo as one step.
  const write = (...writes: Write[]) =>
    transact(group.dataGraph, () => {
      for (const [property, value] of writes) {
        if (!property) continue;
        const [current, ...rest] = property.getObjects();
        for (const extra of rest) property.removeObject(extra);
        if (value === undefined) {
          if (current) property.removeObject(current);
        } else {
          const next = factory.literal(String(value), xsd("integer"));
          if (current) property.replaceObject(current, next);
          else property.addObject(next);
        }
      }
    });

  const required = min !== undefined && min >= 1;
  const multiple = max === undefined || max > 1;

  const setRequired = (checked: boolean) => write([minProperty, checked ? 1 : undefined]);

  // Unchecking "Multiple" caps at one value, which a higher minimum would contradict.
  const setMultiple = (checked: boolean) => {
    if (checked) write([maxProperty, undefined]);
    else if (min !== undefined && min > 1) write([maxProperty, 1], [minProperty, 1]);
    else write([maxProperty, 1]);
  };

  // Laid out like any other field - a FormElement label above the control - rather than with a
  // group's own title chrome: to the user this is one "Cardinality" field.
  return (
    <FormElement
      label={label}
      labelId={labelId}
      description={description}
      className="st-cardinality-property-group"
      dataId={group.node.value}
    >
      <div className="st-cardinality-property-group__control" role="group" aria-labelledby={labelId}>
        <div className="st-cardinality-property-group__checkboxes">
          {minProperty && (
            <label className="st-option">
              <input
                type="checkbox"
                className="st-checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
              />
              <Localized id="cardinality-property-group-required">Required</Localized>
            </label>
          )}
          {maxProperty && (
            <label className="st-option">
              <input
                type="checkbox"
                className="st-checkbox"
                checked={multiple}
                onChange={(event) => setMultiple(event.target.checked)}
              />
              <Localized id="cardinality-property-group-multiple">Multiple</Localized>
            </label>
          )}
        </div>
        <details
          className="st-cardinality-property-group__advanced"
          open={advancedOpen}
          onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        >
          <summary className="st-cardinality-property-group__advanced-title">
            <Chevron />
            <Localized id="cardinality-property-group-advanced">Advanced</Localized>
          </summary>
          <div className="st-cardinality-property-group__advanced-body">
            <EditUIElementChildren elements={group.children} />
          </div>
        </details>
      </div>
    </FormElement>
  );
}
