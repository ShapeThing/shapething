import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import { useActiveBranch } from "@/outputs/render/hooks/useActiveBranch.tsx";
import useActiveElement from "@/outputs/render/hooks/useActiveElement.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import { logicalBranches, withBranch } from "@/structure/logicalBranches.ts";
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
  onTermSet,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  index: number;
  onTermSet: () => void;
}) {
  // A property constrained by sh:or/sh:xone has no top-level sh:datatype/sh:class of its own -
  // widget scoring needs the currently active branch's constraints merged in too, or it stays
  // blind to them entirely (see structure/logicalBranches.ts).
  const branches = useMemo(() => logicalBranches(propertyUIElement), [propertyUIElement]);
  const activeBranch = useActiveBranch(propertyUIElement, object, branches);
  const effectiveProperty = activeBranch
    ? withBranch(propertyUIElement, activeBranch.shape)
    : propertyUIElement;

  const { Widget, isPlaceholderData } = useWidget(shui("editor"), effectiveProperty, object) ?? {};
  const [ActiveWidget, setActiveWidget] = useState<typeof Widget | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  const activeElement = useActiveElement();
  const currentlyFocused = ref.current?.contains(activeElement);

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
  const unit = propertyUIElement.getOne(sh("unit"))?.value;

  return (
    <div className="st-property-object">
      {ActiveWidget && (
        <div className="st-property-object__widget" ref={ref} data-widget={ActiveWidget?.name}>
          <ActiveWidget shape={effectiveProperty} term={object} setTerm={setTerm} />
          {currentlyFocused && (
            <div className="st-property-object__fly-out">
              <LogicalConstraintSwitcher
                shape={propertyUIElement}
                term={object}
                setTerm={setTerm}
              />
              <WidgetSwitcher
                ActiveWidget={ActiveWidget}
                setActiveWidget={setActiveWidget}
                shape={effectiveProperty}
              />
            </div>
          )}
        </div>
      )}
      {unit && <span className="st-property-object__unit">{unit}</span>}
      <PropertyUIComponentRemove
        onRemove={onTermSet}
        propertyUIElement={propertyUIElement}
        object={object}
      />
    </div>
  );
}
