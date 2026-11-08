import type { Literal, Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { clsx } from "clsx";
import WidgetSlot from "@/outputs/render/modes/view/WidgetSlot.tsx";
import Link, { insideLinkContext } from "@/outputs/render/components/Link/index.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { termKey } from "@/helpers/termKey.ts";
import { termHueStyle } from "@/helpers/termHue.ts";
import { propertyHref } from "@/structure/href.ts";
import DiffText from "@/outputs/render/modes/view/DiffText.tsx";
import type { DiffStatus } from "@/outputs/render/modes/view/propertyDiff.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * One value in view mode. With Environment.additionsGraph/deletionsGraph (see propertyDiff.ts), an
 * added value is wrapped in <ins> and a removed one in <del>, each with a hidden "Added"/"Removed"
 * for screen readers; an edited text (`changedFrom` set) instead shows the new text with the edit
 * marked inside it (DiffText), in place of its viewer.
 *
 * With st:href (structure/href.ts) the value is a link to the href found on the focus node: the
 * viewer renders inside it, and a link of the viewer's own (components/Link) renders as plain
 * content there, as a link can not hold another one.
 *
 * Each value carries `--st-term-hue`, a hue of its own (helpers/termHue.ts), for stylesheets.
 */
export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
  labelledBy,
  diffStatus,
  changedFrom,
  isDefault = false,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  labelledBy: string;
  /** A sh:defaultValue shown in place of a missing value (Environment.enableDefaultValuesInViewMode). */
  isDefault?: boolean;
  diffStatus?: DiffStatus;
  changedFrom?: Literal;
}) {
  const status = changedFrom ? "changed" : diffStatus;
  const Wrapper = status === "added" ? "ins" : status === "removed" ? "del" : "div";
  const href = useReactiveRead(
    propertyUIElement.dataGraph,
    `href@${termKey(propertyUIElement.focusNode)}@${propertyUIElement.dataId()}`,
    () => propertyHref(propertyUIElement),
  );

  const content =
    changedFrom && object.termType === "Literal" ? (
      <div className="st-property-object__widget" data-widget="DiffText">
        <DiffText removed={changedFrom} added={object} />
      </div>
    ) : (
      <WidgetSlot propertyUIElement={propertyUIElement} object={object} labelledBy={labelledBy} />
    );

  return (
    <Wrapper
      className={clsx("st-property-object-wrapper", status && ["st-diff", `st-diff--${status}`])}
      data-diff={status}
      data-default={isDefault || undefined}
      style={termHueStyle(object)}
    >
      {status && (
        <Localized id={`diff-${status}`}>
          <span className="st-visually-hidden">{status}</span>
        </Localized>
      )}
      <div className="st-property-object">
        <div className="st-property-object-main">
          {href ? (
            <Link className="st-href" href={href}>
              <insideLinkContext.Provider value={true}>{content}</insideLinkContext.Provider>
            </Link>
          ) : (
            content
          )}
        </div>
      </div>
    </Wrapper>
  );
}
