import { select } from "@shapething/shacl-renderer";
import { use } from "react";
import { NavLink } from "react-router";
import { subjectPath, type Origin } from "../app/paths.ts";
import { termTitle, useTermLabel } from "../app/termLabel.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { termKey, type Resource } from "../data-model/rdf.ts";
import { termToSegment } from "../data-model/segments.ts";
import { cached } from "../data-model/storeCache.ts";
import { subjectBindings } from "./listTabs.ts";
import type { Subject } from "./useSubject.ts";
import relatedShapes from "./queries/relatedShapes.rq";

type RelatedShape = { shape: Resource; origin: Origin };

function loadRelatedShapes(dataModel: DataModel, subject: Subject, origin: Origin) {
  const key = `relatedShapes ${origin} ${subject.kind} ${termKey(subject.term)}`;
  return cached(dataModel.store, key, async () => {
    const rows = await select(
      relatedShapes,
      dataModel.store,
      subjectBindings(subject, origin, dataModel),
    );
    const byShape = new Map<string, RelatedShape>();
    for (const { shape, shapeOrigin } of rows) {
      if (!byShape.has(termKey(shape))) {
        byShape.set(termKey(shape), { shape, origin: shapeOrigin.value as Origin });
      }
    }
    return [...byShape.values()];
  });
}

// The shapes that also apply to the subject's focus nodes, through a target other than
// sh:targetClass.
export function RelatedShapes({ subject, origin }: { subject: Subject; origin: Origin }) {
  const dataModel = useDataModel();
  const termLabel = useTermLabel();
  const related = use(loadRelatedShapes(dataModel, subject, origin));
  if (related.length === 0) return <p>No related shapes.</p>;

  return (
    <ul className="st-related">
      {related.map(({ shape, origin }) => (
        <li key={termKey(shape)}>
          <NavLink
            to={subjectPath(origin, "shape", termToSegment(shape, dataModel))}
            title={termTitle(shape, dataModel)}
          >
            {termLabel(shape)}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
