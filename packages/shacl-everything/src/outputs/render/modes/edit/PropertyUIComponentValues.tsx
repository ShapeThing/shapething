import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useDefaultObject } from "@/outputs/render/hooks/useDefaultObject.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import PropertyUIComponentAdd from "@/outputs/render/modes/edit/PropertyUIComponentAdd.tsx";
import PropertyUIComponentObject from "@/outputs/render/modes/edit/PropertyUIComponentObject.tsx";
import { filterByContentLanguage } from "@/helpers/filterByContentLanguage.ts";
import { termKey } from "@/helpers/termKey.ts";
import { shui } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Loading } from "@/helpers/icons.tsx";

/**
 * RDF values have no inherent order, and rdf-stores moves a value to the end of its internal
 * index on every edit (replaceObject() is a remove + re-add of the underlying quad, never an
 * in-place update) - left alone, that reshuffles this property's whole value list on every
 * keystroke. This keeps `previousOrder` (term keys, from the last render) stable across reads
 * that reorder internally: values still present keep their slot, and only genuinely new/removed
 * values change the order - removed ones drop out, added ones append at the end sorted among
 * themselves (so first render is a deterministic alphabetical order rather than whatever the
 * store's iteration order happens to be). An edited value looks identical to "old value removed,
 * new value added" from here, so it still lands at the end unless replaceInOrder() below has
 * already patched previousOrder in place for it.
 */
function reconcileOrder(
  previousOrder: string[],
  current: Term[],
): { order: string[]; objects: Term[] } {
  const byKey = new Map(current.map((term) => [termKey(term), term]));
  const retained = previousOrder.filter((key) => byKey.has(key));
  const retainedKeys = new Set(retained);
  const added = current
    .filter((term) => !retainedKeys.has(termKey(term)))
    .sort((a, b) => a.value.localeCompare(b.value));
  const order = [...retained, ...added.map(termKey)];
  return { order, objects: order.map((key) => byKey.get(key)!) };
}

/**
 * The ordinary per-value rendering path: one widget instance per existing value (plus a trailing
 * empty one to add another), each resolved and rendered via PropertyUIComponentObject. Split out
 * of PropertyUIComponent so a sh:memberShape property (rendered by MemberShapeList instead - see
 * PropertyUIComponent) never mounts any of this: its widget/default-object resolution and
 * empty-widget bookkeeping don't apply to a property whose single value is an rdf:List head.
 */
export default function PropertyUIComponentValues({
  propertyUIElement,
  labelId,
  autoFocusFirst,
}: {
  propertyUIElement: PropertyUIElement;
  labelId: string;
  // True when this property is the first field of a nested form (DetailsEditor) that was itself
  // just added - see NodeUIElementChildren. A genuinely new nested node has no values of its own
  // yet, so this lines up with the same "index 0" placeholder as showEmptyWidget below.
  autoFocusFirst?: boolean;
}) {
  const { languageMode } = useEnvironment();
  const { activeLanguage } = useContentLanguage();
  // Reads this.dataGraph reactively - addObject() below re-renders only this property, not the
  // whole tree, once the write it makes actually lands (see helpers/reactiveRdfStore.ts).
  const existingObjects = useDataGraphObjects(propertyUIElement);
  // Narrows a multi-lingual property (e.g. rdf:langString "Cat"@en / "Kat"@nl) down to the value
  // matching the currently active content language - values with no language tag, and non-literal
  // values, are unaffected. Skipped entirely in "individual" mode, where every translation renders
  // side by side instead of one at a time.
  const unorderedLanguageFilteredObjects =
    languageMode === "individual"
      ? existingObjects
      : filterByContentLanguage(existingObjects, activeLanguage);
  // See reconcileOrder() above - keeps this property's values from reshuffling on every edit.
  const orderRef = useRef<string[]>([]);
  const { order, objects: languageFilteredObjects } = reconcileOrder(
    orderRef.current,
    unorderedLanguageFilteredObjects,
  );
  orderRef.current = order;
  // setTerm (PropertyUIComponentObject) already knows exactly which old value became which new
  // one - patching orderRef here means an edit keeps its slot instead of looking, to
  // reconcileOrder on the next render, like an unrelated value disappearing and a new one
  // appearing at the end.
  const replaceInOrder = useCallback((oldTerm: Term, newTerm: Term) => {
    const index = orderRef.current.indexOf(termKey(oldTerm));
    if (index !== -1) orderRef.current[index] = termKey(newTerm);
  }, []);
  const [showEmptyWidget, setShowEmptyWidget] = useState(languageFilteredObjects.length === 0);

  // Set only by the "+" button's own click (see the wrapped setter passed to
  // PropertyUIComponentAdd below) - never by the activeLanguage/hadFilteredValues effects below,
  // which also reopen the empty widget but shouldn't ever focus it (see AutoCompleteEditor's own
  // near-identical "never on initial mount" reasoning - a screen with several empty properties
  // must not turn into a focus race). Reset after every render once it's been read into this
  // render's `objects`, so it can't leak into an unrelated later render of this same component.
  const justClickedAddRef = useRef(false);
  useEffect(() => {
    justClickedAddRef.current = false;
  });

  // Switching the active language can leave this property with no existing value in the newly
  // active language at all - re-show the empty widget in that case, same as removing the last
  // value does, so there's always something to type a translation into. Deliberately keyed on
  // activeLanguage alone (not languageFilteredObjects) - this should only fire on a language
  // switch, not on every data write that happens to change the filtered set for other reasons.
  useEffect(() => {
    setShowEmptyWidget(languageFilteredObjects.length === 0);
  }, [activeLanguage]);

  // Values in the active language can also disappear without the active language changing at all
  // and without going through this property's own widget - e.g. ContentLanguageSwitcher bulk-
  // deleting every literal in a language elsewhere in the data graph. That path has no onRemove
  // callback to call syncShowEmptyWidget through, so catch the same "went from having a value to
  // having none" transition here instead. Only ever flips this to true, never false, so it can't
  // fight the "0 -> 1" transition while typing into the empty widget commits a first value (see
  // the activeLanguage effect above for why that direction has to stay untouched).
  const hasFilteredValues = languageFilteredObjects.length > 0;
  const hadFilteredValues = useRef(hasFilteredValues);
  useEffect(() => {
    if (hadFilteredValues.current && !hasFilteredValues) setShowEmptyWidget(true);
    hadFilteredValues.current = hasFilteredValues;
  }, [hasFilteredValues]);

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

  // Which rendered index (if any) should receive focus this render - the newly-appended
  // placeholder from an actual "+" click takes priority over autoFocusFirst, though in practice
  // the two never fire on the same render (see the autoFocusFirst prop doc above).
  const targetFocusIndex = justClickedAddRef.current
    ? objects.length - 1
    : autoFocusFirst
      ? 0
      : -1;

  return (
    <>
      <div className="st-property-items">
        {objects.map((object, index) => (
          <Suspense key={index} fallback={<Loading />}>
            <PropertyUIComponentObject
              key={index}
              propertyUIElement={propertyUIElement}
              object={object}
              labelledBy={labelId}
              onReplace={replaceInOrder}
              onTermSet={syncShowEmptyWidget}
              // Removing a value can leave a single-valued field (its "+" always hidden, and now
              // its "-" no longer hidden either) with none left and no other way back to an
              // editable widget - re-show the empty one whenever that happens, for any field.
              onRemove={syncShowEmptyWidget}
              autoFocus={index === targetFocusIndex}
            />
          </Suspense>
        ))}
      </div>
      {!isSingleUnifiedWidget && (
        <PropertyUIComponentAdd
          showEmptyWidget={showEmptyWidget}
          setShowEmptyWidget={(show) => {
            // Only this call site (the actual "+" click) may request focus - see justClickedAddRef
            // above.
            justClickedAddRef.current = show;
            setShowEmptyWidget(show);
          }}
          propertyUIElement={propertyUIElement}
        />
      )}
    </>
  );
}
