import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { termKey } from "@/helpers/termKey.ts";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { createIdentityMemo, EMPTY_SCORES_GRAPH } from "@/structure/memo.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { groupPropertyShapesByPath } from "@/structure/propertiesForShape.ts";
import { walkShapeComposition } from "@/structure/shapeComposition.ts";
import type { Widgets } from "@/widgets/types.ts";

const memo = createIdentityMemo<(PropertyUIElement | ChoiceElement)[]>();

/**
 * Expands `shape` (one node shape, or several - e.g. NodeUIElement.children() passing its whole
 * nodeShapes list at once - or a shape reached via sh:and/sh:node - never a property shape, whose
 * sh:node means something else entirely, see DetailsEditor) into the PropertyUIElements/
 * ChoiceElements it contributes to `focusNode`.
 *
 * All sh:property shapes reachable via `shape` itself plus sh:and/sh:node recursion (across every
 * shape passed in, when given an array) are collected into ONE flat list first, then grouped by
 * canonical SPARQL path (groupPropertyShapesByPath) into a single PropertyUIElement per path -
 * SHACL treats co-path property shapes as conjunctive constraints on one logical property, and
 * that holds regardless of which applicable shape happens to declare a given path, not just
 * within one shape's own sh:property list. The walk itself (shapeComposition.ts's
 * walkShapeComposition) keeps a `visited` set (keyed by termKey) against processing the same
 * shape's contents twice - both as a cycle guard (shape graphs are assumed acyclic, but nothing
 * upstream actually enforces that) and so a shape reachable two ways (e.g. listed directly in
 * nodeShapes AND pulled in via another listed shape's sh:node) doesn't contribute duplicate
 * property-shape entries into the merge.
 *
 * A `sh:deactivated true` shape reached via sh:property/sh:and/sh:node is skipped entirely, like
 * SHACL itself skips evaluating it - neither rendered nor merged into a co-path group's
 * constraints. The start shapes themselves are left to the caller (see
 * resolution/focusNodeAndNodeShapeResolution.ts, which already filters deactivated node shapes).
 *
 * sh:or/sh:xone are wrapped as a ChoiceElement instead of being folded into the path merge - each
 * branch is an alternative, not a conjunction, so ChoiceElement.children() deliberately starts
 * every branch with its own independent walk rather than sharing state with the outer one.
 *
 * Memoized: the result depends on shapesGraph alone (read-only for an Environment's lifetime), so
 * the same inputs - same graphs/registry by identity, same shape(s)/focusNode/ancestorPath by
 * value - always return the very same array of the very same element instances. Render code calls
 * this (via NodeUIElement.children()) on every render, and stable identities keep React memos,
 * query keys and component state from churning. Anything data-dependent (values, the active
 * branch, which node shapes apply in the first place) is read live by the caller or the element
 * itself, never cached here.
 */
export function childrenForShape(
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  shape: Term | Term[],
  focusNode: Quad_Subject,
  scoresGraph: RdfStore | undefined,
  widgets: Widgets,
  // See NodeUIElementOptions.ancestorPath / PropertyUIElement.dataId() - forwarded unchanged into
  // every PropertyUIElement/ChoiceElement produced here, since expanding `shape` itself (sh:and/
  // sh:node/sh:or/sh:xone) stays at the same focusNode and so isn't its own hop.
  ancestorPath: string[] = [],
): (PropertyUIElement | ChoiceElement)[] {
  const shapes = Array.isArray(shape) ? shape : [shape];
  const scores = scoresGraph ?? EMPTY_SCORES_GRAPH;
  const key = JSON.stringify([shapes.map(termKey), termKey(focusNode), ancestorPath]);

  return memo([shapesGraph, dataGraph, scores, widgets], key, () => {
    const { propertyShapes, choices } = walkShapeComposition(shapesGraph, shapes);

    const choiceElements = choices.map(
      ({ shape: choiceShape, connective, list }) =>
        new ChoiceElement({
          shapesGraph,
          dataGraph,
          scoresGraph: scores,
          widgetRegistry: widgets,
          focusNode,
          shape: choiceShape,
          connective,
          list,
          ancestorPath,
          expandBranch: (branchShape) =>
            childrenForShape(
              shapesGraph,
              dataGraph,
              branchShape,
              focusNode,
              scores,
              widgets,
              ancestorPath,
            ),
        }),
    );

    return [
      ...groupPropertyShapesByPath(
        shapesGraph,
        dataGraph,
        propertyShapes,
        focusNode,
        scores,
        widgets,
        ancestorPath,
      ),
      ...choiceElements,
    ];
  });
}
