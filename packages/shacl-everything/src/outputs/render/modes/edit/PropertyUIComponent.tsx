import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useDefaultObject } from "@/outputs/render/hooks/useDefaultObject.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import PropertyUIComponentAdd from "@/outputs/render/modes/edit/PropertyUIComponentAdd.tsx";
import PropertyUIComponentObject from "@/outputs/render/modes/edit/PropertyUIComponentObject.tsx";
import { localName } from "@/helpers/localName.ts";
import { filterByContentLanguage } from "@/helpers/filterByContentLanguage.ts";
import { sh, shui } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";
import { Suspense, useEffect, useState } from "react";
import { Loading } from "@/helpers/icons.tsx";

type PropertyUIComponentProps = {
  propertyUIElement: PropertyUIElement;
};

export default function PropertyUIComponent({ propertyUIElement }: PropertyUIComponentProps) {
  const { languageMode } = useEnvironment();
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  // Reads this.dataGraph reactively - addObject() below re-renders only this property, not the
  // whole tree, once the write it makes actually lands (see helpers/reactiveRdfStore.ts).
  const existingObjects = useDataGraphObjects(propertyUIElement);
  // Narrows a multi-lingual property (e.g. rdf:langString "Cat"@en / "Kat"@nl) down to the value
  // matching the currently active content language - values with no language tag, and non-literal
  // values, are unaffected. sh:minCount/severity below still use the unfiltered existingObjects,
  // since SHACL conformance doesn't care which language happens to be on screen. Skipped entirely
  // in "individual" mode, where every translation renders side by side instead of one at a time.
  const languageFilteredObjects =
    languageMode === "individual"
      ? existingObjects
      : filterByContentLanguage(existingObjects, activeLanguage);
  const [showEmptyWidget, setShowEmptyWidget] = useState(languageFilteredObjects.length === 0);

  // Switching the active language can leave this property with no existing value in the newly
  // active language at all - re-show the empty widget in that case, same as removing the last
  // value does, so there's always something to type a translation into. Deliberately keyed on
  // activeLanguage alone (not languageFilteredObjects) - this should only fire on a language
  // switch, not on every data write that happens to change the filtered set for other reasons.
  useEffect(() => {
    setShowEmptyWidget(languageFilteredObjects.length === 0);
  }, [activeLanguage]);

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
    ? [languageFilteredObjects[0] ?? defaultObject].filter((object) => object !== undefined)
    : showEmptyWidget && defaultObject
      ? [...languageFilteredObjects, defaultObject]
      : languageFilteredObjects;

  // Re-derives whether the empty widget should show from the live data, rather than assuming a
  // write always means "a value now exists in the active language" - a write can just as well be
  // the per-value language <select> retagging the only active-language value to a different
  // language, which must bring the empty widget straight back rather than leaving this property
  // rendering nothing at all until the active language happens to change too.
  const syncShowEmptyWidget = () =>
    setShowEmptyWidget(
      (languageMode === "individual"
        ? propertyUIElement.getObjects()
        : filterByContentLanguage(propertyUIElement.getObjects(), activeLanguage)
      ).length === 0,
    );

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
      label={propertyUIElement.label([activeInterfaceLanguage])?.value}
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
              onTermSet={syncShowEmptyWidget}
              // Removing a value can leave a single-valued field (its "+" always hidden, and now
              // its "-" no longer hidden either) with none left and no other way back to an
              // editable widget - re-show the empty one whenever that happens, for any field.
              onRemove={syncShowEmptyWidget}
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
