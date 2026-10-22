import type { NamedNode, Term } from "@rdfjs/types";
import { useMemo } from "react";
import { useDataModel } from "@/data-model/useDataModel.ts";
import { termKey } from "@/helpers/iri.ts";
import { ancestorsOf } from "@/ontology/model.ts";
import { useOntology } from "@/ontology/useOntology.ts";
import { targetClassesOf, type NodeShape, type PropertyShape } from "@/shapes/model.ts";
import { describePath } from "@/shapes/paths.ts";
import { resolveProperties } from "@/shapes/resolveProperties.ts";
import { useShapes } from "@/shapes/useShapes.ts";
import { alignProperties, type AlignedOrigin } from "./model.ts";

type Row = { propertyShape: PropertyShape; origin: AlignedOrigin };

/**
 * The aligned property list for a focus: a node shape (its own, sh:node and inherited property
 * shapes plus ontology properties in scope of its target classes) or a class (every shape that
 * targets it, plus what its superclasses' shapes add).
 *
 * `hiddenShapes` (shape keys) drops everything a node shape contributes: its own property shapes,
 * those reached through its sh:node, and what it passes on to subclasses. It is applied before
 * deduplication, so a property shared by a hidden and a visible shape stays, under the visible one.
 */
export function useAlignedProperties(
  focus: { shape?: NodeShape; owlClass?: NamedNode },
  hiddenShapes: ReadonlySet<string> = new Set(),
) {
  const { store } = useDataModel();
  const { classes, properties } = useOntology();
  const shapes = useShapes();
  const hiddenKey = [...hiddenShapes].sort().join(" ");

  return useMemo(() => {
    const focusClasses = focus.shape
      ? targetClassesOf(focus.shape)
      : focus.owlClass
        ? [focus.owlClass]
        : [];
    const scope: NamedNode[] = [];
    for (const owlClass of focusClasses) {
      for (const iri of [owlClass.value, ...ancestorsOf(classes, owlClass.value)]) {
        const term = classes.get(iri)?.term;
        if (term && !scope.some((c) => c.equals(term))) scope.push(term);
      }
    }

    const visible = (shape: NodeShape) => !hiddenShapes.has(shape.key);
    const classShapes = focus.shape
      ? []
      : (shapes.shapesByClass.get(focusClasses[0]?.value ?? "") ?? []);
    const resolve = (shape: NodeShape) =>
      resolveProperties(shape, shapes).filter(
        (row) => row.origin.kind !== "inherited" || !hiddenShapes.has(termKey(row.origin.shape)),
      );

    // resolveProperties already walks the ancestors for a shape on the class; the ancestor pass
    // below covers a class without a (visible) shape of its own.
    const resolved: Row[] = focus.shape
      ? visible(focus.shape)
        ? resolve(focus.shape)
        : []
      : [
          ...classShapes.filter(visible).flatMap((shape) =>
            resolve(shape).flatMap((row): Row[] => {
              const { origin } = row;
              if (origin.kind === "defined") {
                return [{ ...row, origin: { kind: "targeting" as const, shape: shape.term } }];
              }
              if (origin.kind !== "node") return [row];
              // An sh:node reference to another shape on this class (ConceptShape sh:node
              // skosapnl:Concept, both targeting skos:Concept) is that shape's own group, and
              // follows that shape's selection.
              const sibling = classShapes.find((s) => s.term.equals(origin.via));
              if (sibling) {
                return visible(sibling)
                  ? [{ ...row, origin: { kind: "targeting" as const, shape: sibling.term } }]
                  : [];
              }
              return [{ ...row, origin: { ...origin, root: shape.term } }];
            }),
          ),
          ...scope.slice(1).flatMap((ancestor) =>
            (shapes.shapesByClass.get(ancestor.value) ?? []).filter(visible).flatMap((shape) =>
              resolve(shape).map((row) =>
                row.origin.kind === "inherited"
                  ? row
                  : {
                      ...row,
                      origin: { kind: "inherited" as const, owlClass: ancestor, shape: shape.term },
                    },
              ),
            ),
          ),
        ];

    const seen = new Set<string>();
    const unique = resolved.filter(
      (row) => !seen.has(row.propertyShape.key) && seen.add(row.propertyShape.key),
    );

    return alignProperties(unique, scope, properties, (path: Term) => describePath(store, path));
    // hiddenKey stands in for hiddenShapes, which is a fresh Set on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.shape, focus.owlClass, classes, properties, shapes, store, hiddenKey]);
}
