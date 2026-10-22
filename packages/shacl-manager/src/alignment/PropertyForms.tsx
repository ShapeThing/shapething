import type { NamedNode } from "@rdfjs/types";
import type { ReactNode } from "react";
import { useT } from "@/app/useT.ts";
import ResourceForm from "@/data-model/ResourceForm.tsx";
import { useDataModel } from "@/data-model/useDataModel.ts";
import { useLabels } from "@/data-model/useLabels.ts";
import type { AlignedProperty } from "./model.ts";

const forms = {
  merged: new URL("./forms/property.ttl#merged", import.meta.url),
  mergedShaclFirst: new URL("./forms/property.ttl#mergedShaclFirst", import.meta.url),
  propertyShape: new URL("./forms/property.ttl#propertyShape", import.meta.url),
  owlProperty: new URL("./forms/property.ttl#owlProperty", import.meta.url),
};

/**
 * The form(s) for one aligned property:
 * - merged: one form, descriptive fields shared between sh:name/rdfs:label etc.
 * - split, shape, ontology: the SHACL and OWL sides as explicitly separate forms.
 */
export default function PropertyForms({ row }: { row: AlignedProperty }) {
  const { isEditable } = useDataModel();
  const t = useT();
  const propertyShape = row.propertyShape?.term;

  if (row.kind === "merged" && propertyShape) {
    const owlProperty = row.owlProperties[0];
    // Writing through sh:path into an imported property would be dropped (read-only), so the
    // SHACL branch comes first and edits become a local sh:name/sh:description override.
    const form = isEditable(owlProperty.term) ? forms.merged : forms.mergedShaclFirst;
    return <ResourceForm form={form} focusNode={propertyShape} />;
  }

  return (
    <div className="st-manager-forms">
      {propertyShape && (
        <FormCard
          title={t("shacl-manager-form-shacl", null, "SHACL · property shape")}
          readOnly={!isEditable(propertyShape)}
        >
          <ResourceForm form={forms.propertyShape} focusNode={propertyShape} />
        </FormCard>
      )}
      {row.owlProperties.map((owlProperty) => (
        <OwlPropertyCard key={owlProperty.iri} property={owlProperty.term} />
      ))}
    </div>
  );
}

function OwlPropertyCard({ property }: { property: NamedNode }) {
  const { isEditable } = useDataModel();
  const labels = useLabels();
  return (
    <FormCard title={`OWL · ${labels.display(property)}`} readOnly={!isEditable(property)}>
      <ResourceForm form={forms.owlProperty} focusNode={property} />
    </FormCard>
  );
}

function FormCard({
  title,
  readOnly,
  children,
}: {
  title: string;
  readOnly: boolean;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section className="st-manager-card">
      <header className="st-manager-card__header">
        <span>{title}</span>
        {readOnly && (
          <span className="st-manager-badge">
            {t("shacl-manager-read-only", null, "import · read-only")}
          </span>
        )}
      </header>
      <div className="st-manager-card__body">{children}</div>
    </section>
  );
}
