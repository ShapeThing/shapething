import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import type { NamedNode, Term } from "@rdfjs/types";
import { useT } from "@/app/useT.ts";
import { useLabels } from "@/data-model/useLabels.ts";
import { termKey } from "@/helpers/iri.ts";
import { ancestorsOf, buildClassForest, type OwlClass } from "@/ontology/model.ts";
import { useOntology } from "@/ontology/useOntology.ts";
import { useShapes } from "@/shapes/useShapes.ts";
import ClassTree from "@/views/overview/ClassTree.tsx";

/**
 * The focus class(es) with all their superclasses, plus direct subclasses and sh:node shapes. The
 * node shapes on these classes are toggles that select whose properties the table shows.
 */
export default function AncestorTrail({
  focusClasses,
  nodeShapes,
  shapeSelection,
}: {
  focusClasses: NamedNode[];
  nodeShapes: Term[];
  shapeSelection: ComponentProps<typeof ClassTree>["shapeSelection"];
}) {
  const t = useT();
  const labels = useLabels();
  const { classes } = useOntology();
  const shapes = useShapes();

  const include = new Set<string>();
  for (const owlClass of focusClasses) {
    include.add(owlClass.value);
    for (const ancestor of ancestorsOf(classes, owlClass.value)) include.add(ancestor);
  }
  const forest = buildClassForest(
    classes,
    (c: OwlClass) => labels.display(c.term).toLowerCase(),
    include,
  );
  const subclasses = [
    ...new Set(focusClasses.flatMap((c) => [...(classes.get(c.value)?.children ?? [])])),
  ].map((iri) => classes.get(iri)!);

  return (
    <nav className="st-manager-trail" aria-label={t("shacl-manager-hierarchy", null, "Hierarchy")}>
      <Link to="/" className="st-manager-back">
        ← {t("shacl-manager-overview", null, "Overview")}
      </Link>
      <h2 className="st-manager-subheading">{t("shacl-manager-hierarchy", null, "Hierarchy")}</h2>
      <ClassTree
        forest={forest}
        shapesByClass={shapes.shapesByClass}
        propertyShapes={shapes.propertyShapes}
        open={() => true}
        focusClasses={new Set(focusClasses.map((c) => c.value))}
        shapeSelection={shapeSelection}
      />
      {subclasses.length > 0 && (
        <details>
          <summary className="st-manager-subheading">
            {t("shacl-manager-subclasses", null, "Subclasses")}{" "}
            <span className="st-manager-count">{subclasses.length}</span>
          </summary>
          <ul className="st-manager-list">
            {subclasses.map((c) => (
              <li key={c.iri}>
                <Link to="/class/$class" params={{ class: encodeURIComponent(c.iri) }}>
                  {labels.display(c.term)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {nodeShapes.length > 0 && (
        <>
          <h2 className="st-manager-subheading">
            {t("shacl-manager-via-node", null, "Also via sh:node")}
          </h2>
          <ul className="st-manager-list">
            {nodeShapes.map((node) => (
              <li key={termKey(node)}>
                <Link to="/shape/$shape" params={{ shape: encodeURIComponent(termKey(node)) }}>
                  ◆ {labels.display(node)}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}
