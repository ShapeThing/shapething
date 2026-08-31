import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import { useActiveBranch } from "@/outputs/render/hooks/useActiveBranch.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useFocusWithinNearest } from "@/outputs/render/hooks/useFocusWithinNearest.tsx";
import { logicalBranches, withBranch, type LogicalBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { NamedNode, Term } from "@rdfjs/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { sh, shui } from "@/helpers/namespaces.ts";
import WidgetSwitcher from "@/outputs/render/modes/edit/WidgetSwitcher.tsx";
import LogicalConstraintSwitcher from "@/outputs/render/modes/edit/LogicalConstraintSwitcher.tsx";

// A read-only value (see Environment.readOnlyGraph) still gets a setTerm prop - a no-op mirrors
// view mode's own WidgetSlot, keeping every widget implementation's setTerm always callable.
const noop = () => {};

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
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  labelledBy: string;
  setTerm: (newTerm: Term) => void;
}) {
  // A property constrained by sh:or/sh:xone has no top-level sh:datatype/sh:class of its own -
  // widget scoring needs the currently active branch's constraints merged in too, or it stays
  // blind to them entirely (see structure/logicalBranches.ts).
  const branches = useMemo(() => logicalBranches(propertyUIElement), [propertyUIElement]);
  const detectedBranch = useActiveBranch(propertyUIElement, object, branches);

  // Which branch the user last explicitly picked via LogicalConstraintSwitcher, kept "pinned"
  // for cases detectedBranch can't cover on its own: switching to a branch whose own required
  // fields (e.g. a nested sh:node's sh:minCount) aren't filled in yet would otherwise never
  // register as active - and without an active branch, its shui:editor override is never merged
  // in, so its widget (e.g. DetailsEditor) never renders for the user to fill those fields into
  // in the first place. Superseded the moment the data itself fully conforms to some branch
  // (including a different one - see the effect below), so this never overrides real data.
  const [pinnedBranchKey, setPinnedBranchKey] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (detectedBranch && detectedBranch.shape.value !== pinnedBranchKey) {
      setPinnedBranchKey(undefined);
    }
  }, [detectedBranch, pinnedBranchKey]);

  const activeBranch =
    detectedBranch ?? branches.find((branch) => branch.shape.value === pinnedBranchKey);
  const effectiveProperty = activeBranch
    ? withBranch(propertyUIElement, activeBranch.shape)
    : propertyUIElement;

  // Just before scoring: a value also present in readOnlyGraph (e.g. an inferred triple - see
  // Environment.readOnlyGraph) renders through its viewer instead of its editor. withBranch()
  // never changes propertyShapes[0], so this is branch-independent - checking on effectiveProperty
  // vs. propertyUIElement makes no difference here, effectiveProperty is just what's already at
  // hand.
  const { readOnlyGraph } = useEnvironment();
  const isReadOnly = readOnlyGraph ? effectiveProperty.isReadOnly(object, readOnlyGraph) : false;

  const {
    Widget,
    iri: resolvedWidgetIri,
    isPlaceholderData,
  } = useWidget(isReadOnly ? shui("viewer") : shui("editor"), effectiveProperty, object) ?? {};
  const [ActiveWidget, setActiveWidget] = useState<typeof Widget | undefined>(undefined);
  const [activeWidgetIri, setActiveWidgetIri] = useState<NamedNode | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  // A nested value's own widget (e.g. DetailsEditor's inline sub-form) renders its properties'
  // .st-property-object__widget wrappers *inside* this one, so a plain ref.contains() would match
  // every ancestor at once when a deeply nested field is focused - each rendering its own
  // absolutely-positioned fly-out on top of the others. useFocusWithinNearest instead finds only
  // the nearest wrapper the focus is actually inside, so just that one property's fly-out shows.
  const currentlyFocused = useFocusWithinNearest(ref, ".st-property-object__widget");

  // Re-sync ActiveWidget when the sh:or/sh:xone branch changes underneath it - not just on first
  // resolve - otherwise switching branches (e.g. boolean -> string) leaves the old branch's widget
  // mounted. Gated on !isPlaceholderData so this waits for the *new* branch's own widget query to
  // resolve, rather than committing the still-stale (keepPreviousData) Widget from the old branch.
  const activeBranchKey = activeBranch?.shape.value;
  const syncedBranchKeyRef = useRef(activeBranchKey);
  useEffect(() => {
    if (!Widget || isPlaceholderData) return;
    const branchChanged = syncedBranchKeyRef.current !== activeBranchKey;
    if (!ActiveWidget || branchChanged) {
      setActiveWidget(() => Widget);
      setActiveWidgetIri(resolvedWidgetIri as NamedNode);
      syncedBranchKeyRef.current = activeBranchKey;
    }
  }, [Widget, ActiveWidget, activeBranchKey, isPlaceholderData, resolvedWidgetIri]);

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
        <WidgetSwitcher
          activeWidgetIri={activeWidgetIri}
          setActiveWidget={(iri, widgetFn) => {
            setActiveWidget(widgetFn);
            setActiveWidgetIri(iri);
          }}
          shape={effectiveProperty}
        />
      </div>
    ) : null;

  return (
    <>
      {ActiveWidget && (
        <div className="st-property-object__widget" ref={ref} data-widget={ActiveWidget?.name}>
          <ActiveWidget
            shape={effectiveProperty}
            term={object}
            setTerm={isReadOnly ? noop : setTerm}
            labelledBy={labelledBy}
          />
          {flyOut}
        </div>
      )}
      {unit && <span className="st-property-object__unit">{unit}</span>}
    </>
  );
}
