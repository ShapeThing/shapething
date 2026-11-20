import { Suspense } from "react";
import { NavLink, useMatch } from "react-router";
import { ListDetail } from "../../../app/ListDetail.tsx";
import { describeBlankNode } from "../../../data-model/blankNodes.ts";
import { useDataModel } from "../../../data-model/dataModelContext.ts";
import { compactIri } from "../../../data-model/prefixes.ts";
import { termToSegment } from "../../../data-model/segments.ts";
import type { Origin } from "../../useShapeTree.ts";
import { type Subject, useSubject } from "../../useSubject.ts";
import { type ShaclRule, useShaclRules } from "./useShaclRules.ts";

export function ShapeRules() {
  const subject = useSubject();
  const origin = (useMatch("/shapes/:origin/*")?.params.origin ?? "managed") as Origin;

  return (
    <ListDetail title="Rules">
      {subject && (
        <Suspense fallback="Loading rules…">
          <RuleList subject={subject} origin={origin} />
        </Suspense>
      )}
    </ListDetail>
  );
}

function RuleList({ subject, origin }: { subject: Subject; origin: Origin }) {
  const rules = useShaclRules(subject, origin);
  if (rules.length === 0) return <p>No SHACL rules.</p>;

  return (
    <ul>
      {rules.map((rule) => (
        <RuleLink key={`${rule.rule.termType} ${rule.rule.value}`} {...rule} />
      ))}
    </ul>
  );
}

// Until labels are picked by language, a rule is shown by its prefixed name, else its first
// rdfs:label, else its IRI.
function RuleLink({ rule, labels }: ShaclRule) {
  const dataModel = useDataModel();
  const isBlank = rule.termType === "BlankNode";
  const name = isBlank ? undefined : compactIri(rule.value, dataModel.prefixes);
  const label = name ?? labels[0]?.value ?? (isBlank ? "(blank node)" : rule.value);

  return (
    <li>
      <NavLink
        to={`./${termToSegment(rule, dataModel)}`}
        title={isBlank ? describeBlankNode(dataModel.store, rule) : rule.value}
      >
        {label}
      </NavLink>
    </li>
  );
}
