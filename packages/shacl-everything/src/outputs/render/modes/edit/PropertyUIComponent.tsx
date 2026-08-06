import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useDefaultObject } from "@/outputs/render/hooks/useDefaultObject.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import PropertyUIComponentAdd from "@/outputs/render/modes/edit/PropertyUIComponentAdd.tsx";
import PropertyUIComponentObject from "@/outputs/render/modes/edit/PropertyUIComponentObject.tsx";
import { localName } from "@/helpers/localName.ts";
import { sh, shui } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";
import { Suspense, useState } from "react";
import { Loading } from "@/helpers/icons.tsx";

type PropertyUIComponentProps = {
  propertyUIElement: PropertyUIElement;
};

export default function PropertyUIComponent({ propertyUIElement }: PropertyUIComponentProps) {
  // Reads this.dataGraph reactively - addObject() below re-renders only this property, not the
  // whole tree, once the write it makes actually lands (see helpers/reactiveRdfStore.ts).
  const existingObjects = useDataGraphObjects(propertyUIElement);
  const [showEmptyWidget, setShowEmptyWidget] = useState(existingObjects.length === 0);

  // getDefaultObject() resolves the widget via score() (async, runs SHACL validation), so it's
  // fetched through a hook rather than called inline here.
  const defaultObject = useDefaultObject(propertyUIElement, true);
  // Warms useWidget()'s cache for this exact (property, defaultObject) pair ahead of time, so that
  // when "Add" is clicked and PropertyUIComponentObject mounts with this same object, its own
  // useWidget() call - same query key - hits cache instead of suspending behind the per-item
  // Suspense below (which would otherwise flash a loading indicator on every single Add click).
  // Also the only place this level has to check singleUnifiedWidget - PropertyUIComponentObject's
  // own useWidget() call resolves the same meta again per object, once one actually renders.
  const { meta } = useWidget(shui("editor"), propertyUIElement, defaultObject) ?? {};
  const isSingleUnifiedWidget = meta?.singleUnifiedWidget?.(propertyUIElement) === true;
  // existingObjects is a live-cached array (see useDataGraphObjects/useReactiveRead) - mutating it
  // in place here would silently grow that same cached array by one on every re-render this branch
  // is taken, since a plain push() never touches the RDF store writes the cache actually keys its
  // invalidation on.
  // A singleUnifiedWidget renders exactly once for the whole property, regardless of value count -
  // it owns reading/writing its own values via `shape`, so it gets whatever's already there (or a
  // fresh default) rather than one instance per existing value.
  const objects = isSingleUnifiedWidget
    ? [existingObjects[0] ?? defaultObject].filter((object) => object !== undefined)
    : showEmptyWidget && defaultObject
      ? [...existingObjects, defaultObject]
      : existingObjects;

  const description = propertyUIElement.getOne(sh("description"))?.value;

  // sh:minCount isn't met yet - the shape's sh:severity (sh:Violation, the spec default, when
  // absent) describes how serious that unmet constraint is, for the caller to style as it sees fit.
  const minCount = parseFloat(propertyUIElement.getOne(sh("minCount"))?.value ?? "0");
  const isMissingRequiredValue = existingObjects.length < minCount;
  const severity = isMissingRequiredValue
    ? (localName(propertyUIElement.getOne(sh("severity"))) ?? "Violation")
    : undefined;

  return (
    <FormElement
      label={propertyUIElement.label()?.value}
      labelTitle={propertyUIElement.pathAsSparql()}
      description={description}
      severity={severity}
    >
      <div className="st-property-items">
        {objects.map((object, index) => (
          <Suspense key={index} fallback={<Loading />}>
            <PropertyUIComponentObject
              key={index}
              index={index}
              propertyUIElement={propertyUIElement}
              object={object}
              onTermSet={() => setShowEmptyWidget(false)}
              // Removing a value can leave a single-valued field (its "+" always hidden, and now
              // its "-" no longer hidden either) with none left and no other way back to an
              // editable widget - re-show the empty one whenever that happens, for any field.
              onRemove={() => setShowEmptyWidget(propertyUIElement.getObjects().length === 0)}
            />
          </Suspense>
        ))}
      </div>
      {!isSingleUnifiedWidget && (
        <PropertyUIComponentAdd
          showEmptyWidget={showEmptyWidget}
          setShowEmptyWidget={setShowEmptyWidget}
          propertyUIElement={propertyUIElement}
        />
      )}
    </FormElement>
  );
}
