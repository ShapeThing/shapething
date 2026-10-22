import { Link } from "@tanstack/react-router";
import type { NamedNode } from "@rdfjs/types";
import { useQueryClient } from "@tanstack/react-query";
import { useT } from "@/app/useT.ts";
import { useDataModel } from "@/data-model/useDataModel.ts";
import { compactIri } from "@/helpers/iri.ts";
import type { AlignedProperty } from "@/alignment/model.ts";
import PropertyForms from "@/alignment/PropertyForms.tsx";
import { createPropertyShape } from "@/alignment/createPropertyShape.ts";
import { kindIcon, usePropertyLabel } from "./PropertyTable.tsx";

export default function PropertyPanel({
  row,
  focusShape,
}: {
  row: AlignedProperty;
  /** The node shape in focus, if any: an ontology-only property can get a shape on it. */
  focusShape?: NamedNode;
}) {
  const t = useT();
  const label = usePropertyLabel();
  const { applyChanges, isEditable, dataModelIRI } = useDataModel();
  const queryClient = useQueryClient();

  const addShape = () => {
    if (!focusShape) return;
    const { additions } = createPropertyShape(focusShape, row.owlProperties[0].term);
    applyChanges({ additions, deletions: [] });
    void queryClient.invalidateQueries({ queryKey: ["shacl-manager-select", dataModelIRI.value] });
  };

  return (
    <aside className="st-manager-panel" aria-label={label(row)}>
      <header className="st-manager-panel__header">
        <h2 className="st-manager-heading">
          <span className={`st-manager-kind st-manager-kind--${row.kind}`}>
            {kindIcon[row.kind]}
          </span>{" "}
          {label(row)}
        </h2>
        <Link
          to="."
          search={(prev: Record<string, unknown>) => ({ ...prev, property: undefined })}
          className="st-icon-button"
          aria-label={t("shacl-manager-close", null, "Close")}
        >
          ✕
        </Link>
      </header>
      <dl className="st-manager-facts">
        {row.propertyShape && (
          <>
            <dt>{t("shacl-manager-fact-shape", null, "shape")}</dt>
            <dd>
              {row.propertyShape.term.termType === "NamedNode"
                ? compactIri(row.propertyShape.term.value)
                : t("shacl-manager-blank-node", null, "blank node")}
            </dd>
          </>
        )}
        {row.path && (
          <>
            <dt>{t("shacl-manager-fact-path", null, "path")}</dt>
            <dd>
              <code>{row.path.text}</code>
              {row.kind === "split" &&
                ` (${t("shacl-manager-complex-path", null, "complex path")})`}
            </dd>
          </>
        )}
        {row.owlProperties.map((property) => (
          <span key={property.iri} className="st-manager-facts__row">
            <dt>{t("shacl-manager-fact-property", null, "property")}</dt>
            <dd>
              {compactIri(property.iri)}
              {!isEditable(property.term) && (
                <span className="st-manager-badge">
                  {t("shacl-manager-read-only", null, "import · read-only")}
                </span>
              )}
            </dd>
          </span>
        ))}
      </dl>
      {row.kind === "ontology" && focusShape && isEditable(focusShape) && (
        <button type="button" className="st-button st-button--primary" onClick={addShape}>
          {t("shacl-manager-add-property-shape", null, "Add a property shape for this property")}
        </button>
      )}
      <PropertyForms key={row.key} row={row} />
    </aside>
  );
}
