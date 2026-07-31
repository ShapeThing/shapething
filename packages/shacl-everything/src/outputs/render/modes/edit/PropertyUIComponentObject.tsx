import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import useActiveElement from "@/outputs/render/hooks/useActiveElement.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { useCallback, useEffect, useRef, useState } from "react";
import "./style.css";
import { sh, shui } from "@/helpers/namespaces.ts";
import WidgetSwitcher from "@/outputs/render/modes/edit/WidgetSwitcher.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";

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
  const { Widget } = useWidget(shui("editor"), propertyUIElement, object) ?? {};
  const [ActiveWidget, setActiveWidget] = useState<typeof Widget | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);
  const { enableWidgetSwitching } = useEnvironment();

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
  const needsFlyOut = enableWidgetSwitching && currentlyFocused && ActiveWidget;

  return (
    <div className="st-property-object">
      {ActiveWidget && (
        <div className="st-property-object__widget" ref={ref}>
          <ActiveWidget shape={propertyUIElement} term={object} setTerm={setTerm} />
          {needsFlyOut && (
            <div className="st-property-object__fly-out">
              {enableWidgetSwitching && (
                <WidgetSwitcher
                  ActiveWidget={ActiveWidget}
                  setActiveWidget={setActiveWidget}
                  shape={propertyUIElement}
                />
              )}
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
