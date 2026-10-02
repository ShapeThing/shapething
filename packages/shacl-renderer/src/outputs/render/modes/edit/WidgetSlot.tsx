import { useSlotResolution } from "@/outputs/render/hooks/useSlotResolution.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useFocusWithin } from "@/outputs/render/hooks/useFocusWithin.tsx";
import { useFocusWithinNearest } from "@/outputs/render/hooks/useFocusWithinNearest.tsx";
import { localName } from "@/helpers/localName.ts";
import { termKey } from "@/helpers/termKey.ts";
import type { LogicalBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { WidgetComponent } from "@/widgets/types.ts";
import type { NamedNode, Term } from "@rdfjs/types";
import { useEffect, useRef, useState } from "react";
import { sh, shui } from "@/helpers/namespaces.ts";
import WidgetSwitcher from "@/outputs/render/modes/edit/WidgetSwitcher.tsx";
import LogicalConstraintSwitcher from "@/outputs/render/modes/edit/LogicalConstraintSwitcher.tsx";
import AlternativePathSwitcher from "@/outputs/render/modes/edit/AlternativePathSwitcher.tsx";
import WidgetErrorBoundary from "@/outputs/render/components/WidgetErrorBoundary/index.tsx";

// A read-only value (see Environment.readOnlyGraph) still gets a setTerm prop - a no-op mirrors
// view mode's own WidgetSlot, keeping every widget implementation's setTerm always callable.
const noop = () => {};

type ResolvedWidget = { Widget: WidgetComponent; iri: NamedNode; resolutionKey: string };

/**
 * Resolves and renders whichever widget currently scores highest for `(propertyUIElement, object)`
 * - the framework layer between a rendered value slot and the widgets themselves. Handles
 * sh:or/sh:xone branch detection/switching, the widget-picker fly-out and the sh:unit suffix, all
 * generically: it has no opinion on what the resolved widget actually is, or on how `setTerm`
 * persists the result, so any caller with a value to render through *some* widget - an ordinary
 * property value (PropertyUIComponentObject) or a member of an rdf:List (MemberShapeListItem) -
 * can reuse it as-is. Renders as a fragment rather than a wrapping element, so a caller's own CSS
 * (e.g. PropertyUIComponentObject's unit-suffix corner rounding, which targets direct children of
 * its own wrapper) still sees `.st-property-object__widget`/`.st-property-object__unit` as direct
 * siblings, exactly as before this was extracted from PropertyUIComponentObject.
 */
export default function WidgetSlot({
  propertyUIElement,
  object,
  labelledBy,
  setTerm,
  autoFocus,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  labelledBy: string;
  setTerm: (newTerm: Term) => void;
  autoFocus?: boolean;
}) {
  // Which branch the user last explicitly picked via LogicalConstraintSwitcher, kept "pinned"
  // for cases branch detection can't cover on its own: switching to a branch whose own required
  // fields (e.g. a nested sh:node's sh:minCount) aren't filled in yet would otherwise never
  // register as active - and without an active branch, its shui:editor override is never merged
  // in, so its widget (e.g. DetailsEditor) never renders for the user to fill those fields into
  // in the first place. Superseded the moment the data itself fully conforms to some branch
  // (including a different one - see the effect below), so this never overrides real data.
  const [pinnedBranchKey, setPinnedBranchKey] = useState<string | undefined>(undefined);

  // Just before scoring: a value also present in readOnlyGraph (e.g. an inferred triple - see
  // Environment.readOnlyGraph) renders through its viewer instead of its editor. Branch-
  // independent (withBranch() never changes propertyShapes[0]), so it's checked up front.
  const { readOnlyGraph } = useEnvironment();
  const isReadOnly = readOnlyGraph ? propertyUIElement.isReadOnly(object, readOnlyGraph) : false;

  // A property constrained by sh:or/sh:xone has no top-level sh:datatype/sh:class of its own -
  // widget scoring needs the currently active branch's constraints merged in too, or it stays
  // blind to them entirely (see structure/logicalBranches.ts). Branch detection and widget
  // resolution run as one query (see useSlotResolution), so the widget scored here is always the
  // one for the branch it's reported alongside - never the unbranched property's first.
  const { detectedBranch, activeBranch, effectiveProperty, Widget, iri, isPlaceholderData } =
    useSlotResolution(propertyUIElement, object, {
      widgetPredicate: isReadOnly ? shui("viewer") : shui("editor"),
      pinnedBranchKey,
    });

  useEffect(() => {
    if (!isPlaceholderData && detectedBranch && detectedBranch.shape.value !== pinnedBranchKey) {
      setPinnedBranchKey(undefined);
    }
  }, [detectedBranch, pinnedBranchKey, isPlaceholderData]);

  // Same "pinned until real data resolves" idea as pinnedBranchKey above, for an
  // sh:alternativePath's own branches (see structure/paths/alternativePathBranches.ts) instead of
  // sh:or/sh:xone: AlternativePathSwitcher.setAlternativePathBranch only moves an already-written
  // triple, so picking a branch before the value exists yet has nothing to move - the pick is kept
  // here instead, and applied the moment the value actually lands (by default, wherever
  // defaultWriteBranch put it) by moving it to the pinned branch, then clearing the pin now that
  // activeAlternativePathBranch can resolve it directly.
  const [pinnedAlternativeBranch, setPinnedAlternativeBranch] = useState<NamedNode | undefined>(
    undefined,
  );
  useEffect(() => {
    if (!pinnedAlternativeBranch) return;
    const actual = propertyUIElement.activeAlternativePathBranch(object);
    if (!actual) return;
    if (!actual.equals(pinnedAlternativeBranch)) {
      propertyUIElement.setAlternativePathBranch(object, pinnedAlternativeBranch);
    }
    setPinnedAlternativeBranch(undefined);
  }, [propertyUIElement, object, pinnedAlternativeBranch]);

  // The naturally resolved (branch, widget) pair, derived straight from the resolution rather than
  // copied into state by an effect (which cost an extra render per resolution). While a new key is
  // still resolving, `Widget` is keepPreviousData's previous result, so the mounted widget stays
  // put rather than unmounting on every keystroke. A resolution that yields no widget at all (or
  // errors) keeps whatever last rendered, as the effect-based version did.
  const resolutionKey = `${activeBranch?.shape.value ?? ""}|${iri?.value ?? ""}`;
  const lastResolvedRef = useRef<ResolvedWidget | undefined>(undefined);
  if (Widget && iri) lastResolvedRef.current = { Widget, iri, resolutionKey };
  const natural = lastResolvedRef.current;

  // A manual WidgetSwitcher pick, remembered alongside the natural resolution it was made on top
  // of: it applies only for as long as that natural resolution is still the current one, so it
  // survives unrelated re-renders (and keepPreviousData's stale-while-resolving phase, which keeps
  // reporting the same resolution) but is dropped the moment the natural resolution itself changes
  // - an sh:or/sh:xone branch switch (e.g. boolean -> string), or a value's own term type changing
  // in a way that reroutes it to a different widget (e.g. BlankNodeEditor assigning an identifier,
  // which turns its term into a NamedNode and should hand off to IRIEditor).
  // Dropped for good (a render-phase state adjustment, not an effect), so a later return to the
  // same natural resolution doesn't resurrect a pick made before it changed.
  const [override, setOverride] = useState<ResolvedWidget | undefined>(undefined);
  if (override && natural && override.resolutionKey !== natural.resolutionKey) {
    setOverride(undefined);
  }
  const active =
    override && natural && override.resolutionKey === natural.resolutionKey ? override : natural;
  const ActiveWidget = active?.Widget;
  const activeWidgetIri = active?.iri;

  const ref = useRef<HTMLDivElement>(null);

  // LogicalConstraintSwitcher (the sh:or/sh:xone branch switcher) belongs to this property as a
  // whole, not to whichever nested field currently has focus, so it must stay mounted - and
  // Tab-reachable - for as long as focus is anywhere within this widget's own subtree, including
  // a nested value's own widget (e.g. DetailsEditor's inline sub-form, which renders its
  // properties' .st-property-object__widget wrappers *inside* this one). WidgetSwitcher is the
  // opposite: a per-value "which widget renders this" choice that only makes sense for whichever
  // wrapper is actually innermost-focused - showing it here too while a nested field has focus
  // would duplicate the nested field's own WidgetSwitcher onscreen at the same time, so it stays
  // gated on the narrower "nearest wrapper" check instead. Both subscribe to one shared focus
  // tracker (see useActiveElement.tsx) and only re-render this slot when their own answer changes.
  const currentlyFocused = useFocusWithin(ref);
  const nearestFocused = useFocusWithinNearest(ref, ".st-property-object__widget");

  const unit = propertyUIElement.get(sh("unit"))[0]?.value;

  // Nothing to switch on a fixed, read-only value - no widget-picker, no branch switcher.
  const flyOut =
    !isReadOnly && currentlyFocused ? (
      <div className="st-property-object__fly-out">
        <LogicalConstraintSwitcher
          shape={propertyUIElement}
          term={object}
          setTerm={setTerm}
          activeBranch={activeBranch}
          onBranchSelected={(branch: LogicalBranch) => setPinnedBranchKey(branch.shape.value)}
        />
        <AlternativePathSwitcher
          shape={propertyUIElement}
          term={object}
          pinnedBranch={pinnedAlternativeBranch}
          onBranchSelected={setPinnedAlternativeBranch}
        />
        {nearestFocused && (
          <WidgetSwitcher
            activeWidgetIri={activeWidgetIri}
            setActiveWidget={(pickedIri, widgetFn) => {
              const picked = widgetFn();
              if (picked && natural) {
                setOverride({
                  Widget: picked,
                  iri: pickedIri,
                  resolutionKey: natural.resolutionKey,
                });
              }
            }}
            shape={effectiveProperty}
            valueNode={object}
          />
        )}
      </div>
    ) : null;

  return (
    <>
      {ActiveWidget && (
        <div
          className="st-property-object__widget"
          ref={ref}
          data-widget={localName(activeWidgetIri)}
          data-read-only={isReadOnly || undefined}
        >
          {/* Around the widget only, not the fly-out: a crashing widget still leaves
              WidgetSwitcher reachable to pick a different one (which resets the boundary). */}
          <WidgetErrorBoundary
            resetKeys={[termKey(object), activeWidgetIri?.value]}
            widget={activeWidgetIri?.value}
          >
            <ActiveWidget
              shape={effectiveProperty}
              term={object}
              setTerm={isReadOnly ? noop : setTerm}
              labelledBy={labelledBy}
              autoFocus={autoFocus}
            />
          </WidgetErrorBoundary>
          {flyOut}
        </div>
      )}
      {unit && <span className="st-property-object__unit">{unit}</span>}
    </>
  );
}
