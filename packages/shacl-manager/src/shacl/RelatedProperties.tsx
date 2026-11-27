import { useMemo } from "react";
import { NavLink } from "react-router";
import { subjectPath } from "../app/paths.ts";
import { termTitle, useTermLabel } from "../app/termLabel.ts";
import { useTermParam } from "../app/useTermParam.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { deactivatedClass } from "../data-model/editGraphs.ts";
import { termKey } from "../data-model/rdf.ts";
import { termToSegment } from "../data-model/segments.ts";
import { relatedProperties } from "./relatedProperties.ts";

// The property shapes the renderer combines with this one into a single property, each linking
// to it on the shape that declares it. Nothing when there are none.
export function RelatedProperties({ param }: { param: string }) {
  const property = useTermParam(param);
  const dataModel = useDataModel();
  const termLabel = useTermLabel();
  const related = useMemo(
    () => (property ? relatedProperties(dataModel.store, property) : []),
    [dataModel.store, property],
  );
  if (!related.length) return null;

  const origin = (shape: (typeof related)[number]["shapes"][number], node: typeof property) =>
    node && dataModel.store.getQuads(shape, null, node, dataModel.dataModelIRI).length
      ? "managed"
      : "imported";

  return (
    <aside className="st-meta__aside st-related-properties">
      <h3 className="st-usage__label">Related properties</h3>
      <ul>
        {related.map(({ property: relatedProperty, shapes }) => (
          <li key={termKey(relatedProperty)}>
            {shapes.map((shape) => (
              <NavLink
                key={termKey(shape)}
                to={`${subjectPath(origin(shape, relatedProperty), "shape", termToSegment(shape, dataModel))}/properties/${termToSegment(relatedProperty, dataModel)}`}
                title={termTitle(relatedProperty, dataModel)}
                className={deactivatedClass(dataModel, relatedProperty)}
              >
                <span>{termLabel(relatedProperty)}</span>
                <span className="st-related-properties__shape">{termLabel(shape)}</span>
              </NavLink>
            ))}
          </li>
        ))}
      </ul>
    </aside>
  );
}
