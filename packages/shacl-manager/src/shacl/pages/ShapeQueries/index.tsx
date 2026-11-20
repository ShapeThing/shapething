import { Suspense } from "react";
import { NavLink, useMatch } from "react-router";
import { ListDetail } from "../../../app/ListDetail.tsx";
import { describeBlankNode } from "../../../data-model/blankNodes.ts";
import { useDataModel } from "../../../data-model/dataModelContext.ts";
import { compactIri } from "../../../data-model/prefixes.ts";
import { termToSegment } from "../../../data-model/segments.ts";
import type { Origin } from "../../useShapeTree.ts";
import { type Subject, useSubject } from "../../useSubject.ts";
import { type SparqlConstraint, useSparqlConstraints } from "./useSparqlConstraints.ts";

export function ShapeQueries() {
  const subject = useSubject();
  const origin = (useMatch("/shapes/:origin/*")?.params.origin ?? "managed") as Origin;

  return (
    <ListDetail title="Queries">
      {subject && (
        <Suspense fallback="Loading queries…">
          <ConstraintList subject={subject} origin={origin} />
        </Suspense>
      )}
    </ListDetail>
  );
}

function ConstraintList({ subject, origin }: { subject: Subject; origin: Origin }) {
  const constraints = useSparqlConstraints(subject, origin);
  if (constraints.length === 0) return <p>No SPARQL-based constraints.</p>;

  return (
    <ul>
      {constraints.map((constraint) => (
        <ConstraintLink
          key={`${constraint.constraint.termType} ${constraint.constraint.value}`}
          {...constraint}
        />
      ))}
    </ul>
  );
}

// Until labels are queried, a constraint is shown by its prefixed name, else its first message
// (constraints are mostly blank nodes), else its IRI.
function ConstraintLink({ constraint, messages }: SparqlConstraint) {
  const dataModel = useDataModel();
  const isBlank = constraint.termType === "BlankNode";
  const name = isBlank ? undefined : compactIri(constraint.value, dataModel.prefixes);
  const label = name ?? messages[0]?.value ?? (isBlank ? "(blank node)" : constraint.value);

  return (
    <li>
      <NavLink
        to={`./${termToSegment(constraint, dataModel)}`}
        title={isBlank ? describeBlankNode(dataModel.store, constraint) : constraint.value}
      >
        {label}
      </NavLink>
    </li>
  );
}
