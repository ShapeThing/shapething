import { Suspense } from "react";
import { NavLink, useMatch } from "react-router";
import { ListDetail } from "../../../app/ListDetail.tsx";
import { describeBlankNode } from "../../../data-model/blankNodes.ts";
import { useDataModel } from "../../../data-model/dataModelContext.ts";
import { compactIri } from "../../../data-model/prefixes.ts";
import { termToSegment } from "../../../data-model/segments.ts";
import type { Origin } from "../../useShapeTree.ts";
import { type Subject, useSubject } from "../../useSubject.ts";
import { type ShapeProperty, useShapeProperties } from "./useShapeProperties.ts";

export function ShapeProperties() {
  const subject = useSubject();
  const origin = (useMatch("/shapes/:origin/*")?.params.origin ?? "managed") as Origin;

  return (
    <ListDetail title="Properties">
      {subject && (
        <Suspense fallback="Loading properties…">
          <PropertyList subject={subject} origin={origin} />
        </Suspense>
      )}
    </ListDetail>
  );
}

function PropertyList({ subject, origin }: { subject: Subject; origin: Origin }) {
  const properties = useShapeProperties(subject, origin);
  if (properties.length === 0) return <p>No property shapes.</p>;

  return (
    <ul>
      {properties.map((property) => (
        <PropertyLink
          key={`${property.propertyShape.termType} ${property.propertyShape.value}`}
          {...property}
        />
      ))}
    </ul>
  );
}

// Until labels are queried, a property shape is shown by its path as a prefixed name, else its
// first sh:name, else its path IRI (property shapes are mostly blank nodes, so not by their own).
function PropertyLink({ propertyShape, path, names }: ShapeProperty) {
  const dataModel = useDataModel();
  const namedPath = path?.termType === "NamedNode" ? path : undefined;
  const label =
    (namedPath && compactIri(namedPath.value, dataModel.prefixes)) ??
    names[0]?.value ??
    namedPath?.value ??
    "(complex path)";
  const isBlank = propertyShape.termType === "BlankNode";

  return (
    <li>
      <NavLink
        to={`./${termToSegment(propertyShape, dataModel)}`}
        title={isBlank ? describeBlankNode(dataModel.store, propertyShape) : propertyShape.value}
      >
        {label}
      </NavLink>
    </li>
  );
}
