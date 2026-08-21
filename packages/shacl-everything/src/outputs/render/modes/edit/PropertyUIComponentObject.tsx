import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import { useActiveBranch } from "@/outputs/render/hooks/useActiveBranch.tsx";
import { useFocusWithinNearest } from "@/outputs/render/hooks/useFocusWithinNearest.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import { logicalBranches, withBranch, type LogicalBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./style.css";
import { sh, shui } from "@/helpers/namespaces.ts";
import WidgetSwitcher from "@/outputs/render/modes/edit/WidgetSwitcher.tsx";
import LogicalConstraintSwitcher from "@/outputs/render/modes/edit/LogicalConstraintSwitcher.tsx";

export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
  index,
  labelledBy,
  onTermSet,
  onRemove,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  index: number;
  labelledBy: string;
  onTermSet: () => void;
  onRemove: () => void;
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

  const { Widget, meta, isPlaceholderData } =
    useWidget(shui("editor"), effectiveProperty, object) ?? {};
  const [ActiveWidget, setActiveWidget] = useState<typeof Widget | undefined>(undefined);
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
      syncedBranchKeyRef.current = activeBranchKey;
    }
  }, [Widget, ActiveWidget, activeBranchKey, isPlaceholderData]);

  const setTerm = useCallback(
    (newTerm: Term) => {
      propertyUIElement.replaceObject(object, newTerm);
      onTermSet();
    },
    [propertyUIElement, object, index, onTermSet],
  );
  const unit = propertyUIElement.get(sh("unit"))[0]?.value;

  const flyOut = currentlyFocused ? (
    <div className="st-property-object__fly-out">
      <LogicalConstraintSwitcher
        shape={propertyUIElement}
        term={object}
        setTerm={setTerm}
        activeBranch={activeBranch}
        onBranchSelected={(branch: LogicalBranch) => setPinnedBranchKey(branch.shape.value)}
      />
      <WidgetSwitcher
        ActiveWidget={ActiveWidget}
        setActiveWidget={setActiveWidget}
        shape={effectiveProperty}
      />
    </div>
  ) : null;

  return (
    <div className="st-property-object">
      {ActiveWidget && (
        <div className="st-property-object__widget" ref={ref} data-widget={ActiveWidget?.name}>
          {ActiveWidget.placesOwnFlyOut ? (
            <ActiveWidget
              shape={effectiveProperty}
              term={object}
              setTerm={setTerm}
              flyOut={flyOut}
              labelledBy={labelledBy}
            />
          ) : (
            <>
              <ActiveWidget
                shape={effectiveProperty}
                term={object}
                setTerm={setTerm}
                labelledBy={labelledBy}
              />
              {flyOut}
            </>
          )}
        </div>
      )}
      {unit && <span className="st-property-object__unit">{unit}</span>}
      <PropertyUIComponentRemove
        onRemove={onRemove}
        propertyUIElement={propertyUIElement}
        object={object}
        clearAll={meta?.singleUnifiedWidget?.(propertyUIElement) === true}
      />
    </div>
  );
}
