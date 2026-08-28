import type { NamedNode, Term } from "@rdfjs/types";
import { useMemo } from "react";
import { getRdfListCells } from "@/helpers/rdfList.ts";
import { rdf } from "@/helpers/namespaces.ts";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import WidgetSlot from "@/outputs/render/modes/view/WidgetSlot.tsx";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * Read-only rendering of a sh:memberShape property's rdf:List - the view-mode counterpart to edit
 * mode's MemberShapeList, minus the reordering/add/remove mechanics: a viewer has nothing to
 * commit back to the list, so this only ever walks it in its current stored order.
 */
export default function MemberShapeList({
  propertyUIElement,
  memberShapeNodes,
  labelledBy,
}: {
  propertyUIElement: PropertyUIElement;
  memberShapeNodes: Term[];
  labelledBy: string;
}) {
  const [head] = useDataGraphObjects(propertyUIElement);
  const currentHead = head ?? rdf("nil");

  const cells = useReactiveRead(
    propertyUIElement.dataGraph,
    `member-shape-list@${currentHead.value}`,
    () => getRdfListCells(currentHead, propertyUIElement.dataGraph),
  );

  const memberElement = useMemo(
    () =>
      new PropertyUIElement({
        shapesGraph: propertyUIElement.shapesGraph,
        dataGraph: propertyUIElement.dataGraph,
        scoresGraph: propertyUIElement.scoresGraph,
        widgetRegistry: propertyUIElement.widgetRegistry,
        focusNode: propertyUIElement.focusNode,
        propertyShapes: memberShapeNodes as NamedNode[],
      }),
    [propertyUIElement, memberShapeNodes],
  );

  return (
    <ul className="st-member-shape-list__items">
      {cells.map((entry) => (
        <li key={entry.cell.value} className="st-member-shape-list__item">
          <WidgetSlot
            propertyUIElement={memberElement}
            object={entry.value}
            labelledBy={labelledBy}
          />
        </li>
      ))}
    </ul>
  );
}
