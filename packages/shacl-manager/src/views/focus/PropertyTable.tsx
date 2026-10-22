import { Link } from "@tanstack/react-router";
import type { Term } from "@rdfjs/types";
import { useT } from "@/app/useT.ts";
import { useLabels } from "@/data-model/useLabels.ts";
import { compactIri, termKey } from "@/helpers/iri.ts";
import {
  groupByOrigin,
  originKey,
  type AlignedOrigin,
  type AlignedProperty,
} from "@/alignment/model.ts";

export const kindIcon: Record<AlignedProperty["kind"], string> = {
  merged: "⇄",
  split: "⫶",
  shape: "◆",
  ontology: "○",
};

export function usePropertyLabel() {
  const labels = useLabels();
  return (row: AlignedProperty) =>
    (row.propertyShape && labels.labelOf(row.propertyShape.term)) ??
    (row.owlProperties[0] && labels.labelOf(row.owlProperties[0].term)) ??
    row.path?.text ??
    (row.owlProperties[0] ? compactIri(row.owlProperties[0].iri) : row.key);
}

export default function PropertyTable({
  rows,
  selected,
  compact,
}: {
  rows: AlignedProperty[];
  selected?: string;
  compact: boolean;
}) {
  const t = useT();
  const labels = useLabels();
  const label = usePropertyLabel();

  const heading = (origin: AlignedOrigin) => {
    switch (origin.kind) {
      case "defined":
        return t("shacl-manager-origin-defined", null, "Defined on this shape");
      case "node":
        return origin.root
          ? t(
              "shacl-manager-origin-node-from",
              { root: labels.display(origin.root), shape: labels.display(origin.via) },
              `${labels.display(origin.root)} → via sh:node → ${labels.display(origin.via)}`,
            )
          : t(
              "shacl-manager-origin-node",
              { shape: labels.display(origin.via) },
              `Via sh:node → ${labels.display(origin.via)}`,
            );
      case "inherited":
        return t(
          "shacl-manager-origin-inherited",
          { owlClass: labels.display(origin.owlClass), shape: labels.display(origin.shape) },
          `Inherited from ${labels.display(origin.owlClass)} (${labels.display(origin.shape)})`,
        );
      case "targeting":
        return t(
          "shacl-manager-origin-targeting",
          { shape: labels.display(origin.shape) },
          `Shape ${labels.display(origin.shape)}`,
        );
      case "domain":
        return t(
          "shacl-manager-origin-domain",
          { owlClass: labels.display(origin.owlClass) },
          `Ontology only: rdfs:domain ${labels.display(origin.owlClass)}`,
        );
    }
  };

  if (rows.length === 0) {
    return (
      <p className="st-manager-muted">
        {t("shacl-manager-no-properties", null, "No properties apply here yet.")}
      </p>
    );
  }

  return (
    <div className={`st-manager-properties${compact ? " st-manager-properties--compact" : ""}`}>
      {groupByOrigin(rows).map((group) => (
        <section key={originKey(group.origin)}>
          <h3 className="st-manager-subheading st-manager-group-heading">
            {heading(group.origin)}
            {group.origin.kind === "targeting" && (
              <ShapeHeadingActions shape={group.origin.shape} />
            )}
          </h3>
          <ul className="st-manager-list">
            {group.rows.map((row) => (
              <li key={row.key}>
                <Link
                  to="."
                  search={(prev: Record<string, unknown>) => ({
                    ...prev,
                    edit: undefined,
                    property: row.key,
                  })}
                  className={`st-manager-property${row.key === selected ? " st-manager-property--active" : ""}`}
                >
                  <span
                    className={`st-manager-kind st-manager-kind--${row.kind}`}
                    title={t(`shacl-manager-kind-${row.kind}`, null, row.kind)}
                  >
                    {kindIcon[row.kind]}
                  </span>
                  <span className="st-manager-property__label">{label(row)}</span>
                  {!compact && (
                    <>
                      <code className="st-manager-property__path">
                        {row.path?.text ?? compactIri(row.owlProperties[0]?.iri ?? "")}
                      </code>
                      <span className="st-manager-property__cardinality">{cardinality(row)}</span>
                      <span className="st-manager-property__type">{valueType(row)}</span>
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function cardinality(row: AlignedProperty) {
  if (!row.propertyShape) return "";
  const { minCount, maxCount } = row.propertyShape;
  return `${minCount ?? 0}..${maxCount ?? "*"}`;
}

function valueType(row: AlignedProperty) {
  const shape = row.propertyShape;
  if (shape?.datatype) return compactIri(shape.datatype.value);
  if (shape?.class) return `→ ${compactIri(shape.class.value)}`;
  const range = row.owlProperties[0]?.ranges.values().next().value;
  return range ? compactIri(range) : "";
}

// Several shapes on one class often share a label (e.g. DCAT-AP EU and NL "Dataset"), so a shape's
// group shows its IRI, plus a way to open that shape's form.
function ShapeHeadingActions({ shape }: { shape: Term }) {
  const t = useT();
  return (
    <>
      <code className="st-manager-group-heading__iri">{shape.value}</code>
      <Link
        to="."
        search={(prev: Record<string, unknown>) => ({
          ...prev,
          property: undefined,
          edit: termKey(shape),
        })}
      >
        {t("shacl-manager-edit", null, "Edit")} ✎
      </Link>
    </>
  );
}
