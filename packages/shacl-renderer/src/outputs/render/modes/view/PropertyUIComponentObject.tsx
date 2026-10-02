import type { Literal, Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { clsx } from "clsx";
import WidgetSlot from "@/outputs/render/modes/view/WidgetSlot.tsx";
import DiffText from "@/outputs/render/modes/view/DiffText.tsx";
import type { DiffStatus } from "@/outputs/render/modes/view/propertyDiff.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * One value in view mode. With Environment.additionsGraph/deletionsGraph (see propertyDiff.ts), an
 * added value is wrapped in <ins> and a removed one in <del>, each with a hidden "Added"/"Removed"
 * for screen readers; an edited text (`changedFrom` set) instead shows the new text with the edit
 * marked inside it (DiffText), in place of its viewer.
 */
export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
  labelledBy,
  diffStatus,
  changedFrom,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  labelledBy: string;
  diffStatus?: DiffStatus;
  changedFrom?: Literal;
}) {
  const status = changedFrom ? "changed" : diffStatus;
  const Wrapper = status === "added" ? "ins" : status === "removed" ? "del" : "div";

  return (
    <Wrapper
      className={clsx("st-property-object-wrapper", status && ["st-diff", `st-diff--${status}`])}
      data-diff={status}
    >
      {status && (
        <Localized id={`diff-${status}`}>
          <span className="st-visually-hidden">{status}</span>
        </Localized>
      )}
      <div className="st-property-object">
        <div className="st-property-object-main">
          {changedFrom && object.termType === "Literal" ? (
            <div className="st-property-object__widget" data-widget="DiffText">
              <DiffText removed={changedFrom} added={object} />
            </div>
          ) : (
            <WidgetSlot
              propertyUIElement={propertyUIElement}
              object={object}
              labelledBy={labelledBy}
            />
          )}
        </div>
      </div>
    </Wrapper>
  );
}
