import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useDefaultObject } from "@/outputs/render/hooks/useDefaultObject.tsx";
import PropertyUIComponentAdd from "@/outputs/render/modes/edit/PropertyUIComponentAdd.tsx";
import PropertyUIComponentObject from "@/outputs/render/modes/edit/PropertyUIComponentObject.tsx";
import { localName } from "@/helpers/localName.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

type PropertyUIComponentProps = {
  propertyUIElement: PropertyUIElement;
};

export default function PropertyUIComponent({ propertyUIElement }: PropertyUIComponentProps) {
  // Reads this.dataGraph reactively - addObject() below re-renders only this property, not the
  // whole tree, once the write it makes actually lands (see helpers/reactiveRdfStore.ts).
  const existingObjects = useDataGraphObjects(propertyUIElement);
  // getDefaultObject() resolves the widget via score() (async, runs SHACL validation), so it's
  // fetched through a hook rather than called inline here.
  const defaultObject = useDefaultObject(propertyUIElement, existingObjects.length === 0);
  const objects =
    existingObjects.length > 0 ? existingObjects : defaultObject ? [defaultObject] : [];

  // sh:minCount isn't met yet - the shape's sh:severity (sh:Violation, the spec default, when
  // absent) describes how serious that unmet constraint is, for the caller to style as it sees fit.
  const minCount = parseFloat(propertyUIElement.getOne(sh("minCount"))?.value ?? "0");
  const isMissingRequiredValue = existingObjects.length < minCount;
  const severity = isMissingRequiredValue
    ? (localName(propertyUIElement.getOne(sh("severity"))) ?? "Violation")
    : undefined;

  return (
    <FormElement label={propertyUIElement.label()?.value} severity={severity}>
      {objects.map((object) => (
        <PropertyUIComponentObject
          key={object.value}
          propertyUIElement={propertyUIElement}
          object={object}
        />
      ))}
      <PropertyUIComponentAdd propertyUIElement={propertyUIElement} />
    </FormElement>
  );
}
