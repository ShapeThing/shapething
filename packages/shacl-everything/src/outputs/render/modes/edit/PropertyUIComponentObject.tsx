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

  const { Widget } = useWidget(shui("editor"), effectiveProperty, object) ?? {};
  const [ActiveWidget, setActiveWidget] = useState<typeof Widget | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  const activeElement = useActiveElement();
  const currentlyFocused = ref.current?.contains(activeElement);

  useEffect(() => {
    if (!ActiveWidget && Widget) setActiveWidget(() => Widget);
  }, [Widget, ActiveWidget]);

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
        <div className="st-property-object__widget" ref={ref}>
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
