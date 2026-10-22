import { useDeferredValue, useMemo, useState } from "react";
import { useT } from "@/app/useT.ts";
import { useDataModel } from "@/data-model/useDataModel.ts";
import { useLabels } from "@/data-model/useLabels.ts";
import type { NodeShape } from "@/shapes/model.ts";
import { ancestorsOf, buildClassForest, pruneForest, type OwlClass } from "@/ontology/model.ts";
import { useOntology } from "@/ontology/useOntology.ts";
import { useShapes } from "@/shapes/useShapes.ts";
import ClassTree from "./ClassTree.tsx";
import TargetingGroups from "./TargetingGroups.tsx";
import "./style.css";

export default function Overview() {
  const t = useT();
  const labels = useLabels();
  const { classes } = useOntology();
  const shapes = useShapes();
  const [search, setSearch] = useState("");
  const [onlyShaped, setOnlyShaped] = useState(false);
  const [hideImports, setHideImports] = useState(false);
  const { isLocal } = useDataModel();
  const showShape = (shape: NodeShape) => !hideImports || isLocal(shape.term);
  const query = useDeferredValue(search.trim().toLowerCase());

  const forest = useMemo(() => {
    const sortKey = (owlClass: OwlClass) => labels.display(owlClass.term).toLowerCase();

    // Searching keeps the matches plus their ancestors, so a hit is still shown in its place.
    let include: Set<string> | undefined;
    if (query) {
      include = new Set();
      for (const owlClass of classes.values()) {
        const shapeMatch = (shapes.shapesByClass.get(owlClass.iri) ?? []).some((shape) =>
          labels.display(shape.term).toLowerCase().includes(query),
        );
        if (
          shapeMatch ||
          labels.display(owlClass.term).toLowerCase().includes(query) ||
          owlClass.iri.toLowerCase().includes(query)
        ) {
          include.add(owlClass.iri);
          for (const ancestor of ancestorsOf(classes, owlClass.iri)) include.add(ancestor);
        }
      }
    }

    // Hiding imports keeps an imported class when a local shape targets it (e.g. dcat:Catalog
    // with this data model's own CatalogShape); its imported shapes are hidden either way.
    const shapesShown = (iri: string) =>
      (shapes.shapesByClass.get(iri) ?? []).some((shape) => !hideImports || isLocal(shape.term));
    const keep = (c: OwlClass) =>
      (!onlyShaped || shapesShown(c.iri)) &&
      (!hideImports || isLocal(c.term) || shapesShown(c.iri));

    const full = buildClassForest(classes, sortKey, include);
    return onlyShaped || hideImports ? pruneForest(full, keep) : full;
  }, [classes, shapes, labels, query, onlyShaped, hideImports, isLocal]);

  return (
    <div className="st-manager-overview">
      <div className="st-manager-toolbar">
        <input
          type="search"
          className="st-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("shacl-manager-search", null, "Search classes and shapes…")}
          aria-label={t("shacl-manager-search", null, "Search classes and shapes…")}
        />
        <label className="st-manager-toggle">
          <input
            type="checkbox"
            checked={onlyShaped}
            onChange={(event) => setOnlyShaped(event.target.checked)}
          />
          {t("shacl-manager-only-shaped", null, "Only classes with a shape")}
        </label>
        <label className="st-manager-toggle">
          <input
            type="checkbox"
            checked={hideImports}
            onChange={(event) => setHideImports(event.target.checked)}
          />
          {t("shacl-manager-hide-imports", null, "Hide imports")}
        </label>
      </div>

      <section>
        <h2 className="st-manager-heading">
          {t("shacl-manager-class-hierarchy", null, "Class hierarchy")}
        </h2>
        <ClassTree
          forest={forest}
          shapesByClass={shapes.shapesByClass}
          propertyShapes={shapes.propertyShapes}
          open={(_node, depth) => Boolean(query) || depth < 1}
          showShape={showShape}
        />
      </section>

      <section>
        <h2 className="st-manager-heading">
          {t("shacl-manager-other-targets", null, "Shapes with other targets")}
        </h2>
        <TargetingGroups
          groups={shapes.targetingGroups}
          propertyShapes={shapes.propertyShapes}
          showShape={showShape}
        />
      </section>
    </div>
  );
}
