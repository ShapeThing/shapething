import { NavLink } from "react-router";
import { termLabel, termTitle } from "../../app/termLabel.ts";
import { useDataModel } from "../../data-model/dataModelContext.ts";
import { termToSegment } from "../../data-model/segments.ts";
import type { Origin } from "../useShapeTree.ts";
import type { Subject } from "../useSubject.ts";
import { type RelatedShape, useRelatedShapes } from "./useRelatedShapes.ts";

// The shapes that also apply to the subject's focus nodes through sh:targetSubjectsOf,
// sh:targetObjectsOf or sh:targetNode (see relatedShapes.rq). Suspends while loading.
export function RelatedShapes({ subject, origin }: { subject: Subject; origin: Origin }) {
  const related = useRelatedShapes(subject, origin);
  if (related.length === 0) return <p>No related shapes.</p>;

  return (
    <ul className="st-related">
      {related.map((entry) => (
        <RelatedShapeItem key={`${entry.shape.termType} ${entry.shape.value}`} {...entry} />
      ))}
    </ul>
  );
}

function RelatedShapeItem({ shape, origin }: RelatedShape) {
  const dataModel = useDataModel();

  return (
    <li>
      <NavLink
        to={`/shapes/${origin}/shape/${termToSegment(shape, dataModel)}`}
        title={termTitle(shape, dataModel)}
      >
        {termLabel(shape, dataModel)}
      </NavLink>
    </li>
  );
}
