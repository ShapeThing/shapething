import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { sh } from "@/helpers/namespaces.ts";
import { facetableRootShapes, shapesTargetingNode, targetsOfShape } from "@/resolution/targets.ts";

/**
 * One fully-determined (focus node, node shape) pair, as produced by
 * `resolveFocusNodeAndNodeShapePairs` below - the spec's "3.2.1 Focus Node and Node Shape
 * Resolution". Neither member is ever absent here; that's the whole point of resolution.
 */
export type FocusNodeAndNodeShapePair = {
  focusNode: Quad_Subject;
  nodeShape: Quad_Subject;
};

export type FocusNodeAndNodeShapeResolutionOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  // Both may be absent - see the four steps below.
  focusNode?: Quad_Subject;
  nodeShape?: Quad_Subject;
};

const isDeactivated = (shapeNode: Quad_Subject, shapesGraph: RdfStore): boolean =>
  shapesGraph
    .getQuads(shapeNode, sh("deactivated"), null)
    .some((quad) => quad.object.value === "true");

/**
 * Spec 3.2.1 "Focus Node and Node Shape Resolution": from a (possibly partial) focus node/node
 * shape input, computes every fully-determined (focus node, node shape) pair. Pure and
 * framework-agnostic - like the rest of `resolution/`, this only reads `shapesGraph`/`dataGraph`,
 * it never renders anything (that's the SHACL UI Application's job, see
 * `outputs/application/ShaclUIApplication.tsx`) and never discards a candidate pair (see step
 * 3/4's note below).
 */
export function resolveFocusNodeAndNodeShapePairs(
  options: FocusNodeAndNodeShapeResolutionOptions,
): FocusNodeAndNodeShapePair[] {
  const { shapesGraph, dataGraph, focusNode, nodeShape } = options;

  // Step 1: both given - the single pair every SHACL UI Application must support.
  if (focusNode && nodeShape) return [{ focusNode, nodeShape }];

  // Step 2: node shape given, focus node absent - one pair per target of that shape (3.1.3).
  if (nodeShape && !focusNode) {
    return targetsOfShape(nodeShape, shapesGraph, dataGraph).map((target) => ({
      focusNode: target as Quad_Subject,
      nodeShape,
    }));
  }

  // Step 3: focus node given, node shape absent - one pair per (non-deactivated) shape that
  // targets it. Every matching shape is returned, not just the first - see the spec's own note
  // that resolution enumerates and discards nothing.
  if (focusNode && !nodeShape) {
    return shapesTargetingNode(focusNode, shapesGraph, dataGraph)
      .filter((shape) => !isDeactivated(shape, shapesGraph))
      .map((shape) => ({ focusNode, nodeShape: shape }));
  }

  // Step 4: both absent - the targets of every non-deactivated node shape in the shapes graph.
  // facetableRootShapes already enumerates exactly the shapes that can produce a target (every
  // explicit target predicate, plus implicit class-shapes/shui:ShapeClass) - a shape with none of
  // those contributes an empty target set either way, so reusing it here is equivalent to (and
  // cheaper than) walking every sh:NodeShape-typed subject.
  return facetableRootShapes(shapesGraph)
    .filter((shape) => !isDeactivated(shape, shapesGraph))
    .flatMap((shape) =>
      targetsOfShape(shape, shapesGraph, dataGraph).map((target) => ({
        focusNode: target as Quad_Subject,
        nodeShape: shape,
      })),
    );
}
