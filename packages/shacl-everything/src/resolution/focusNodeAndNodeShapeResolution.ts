import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { isAbstract } from "@/helpers/isAbstract.ts";
import { isDeactivated } from "@/helpers/isDeactivated.ts";
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
  // that resolution enumerates and discards nothing - except a dash:abstract one that a concrete
  // shape also covers (see preferConcreteShapes).
  if (focusNode && !nodeShape) {
    const shapes = shapesTargetingNode(focusNode, shapesGraph, dataGraph)
      .filter((shape) => !isDeactivated(shape, shapesGraph));
    return preferConcreteShapes(shapes, [shapesGraph, dataGraph])
      .map((shape) => ({ focusNode, nodeShape: shape }));
  }

  // Step 4: both absent - the targets of every non-deactivated node shape in the shapes graph.
  // facetableRootShapes already enumerates exactly the shapes that can produce a target (every
  // explicit target predicate, plus implicit class-shapes/shui:ShapeClass) - a shape with none of
  // those contributes an empty target set either way, so reusing it here is equivalent to (and
  // cheaper than) walking every sh:NodeShape-typed subject. Per focus node, a dash:abstract shape
  // gives way to a concrete one the same way step 3 does (see preferConcreteShapes).
  const pairs = facetableRootShapes(shapesGraph)
    .filter((shape) => !isDeactivated(shape, shapesGraph))
    .flatMap((shape) =>
      targetsOfShape(shape, shapesGraph, dataGraph).map((target) => ({
        focusNode: target as Quad_Subject,
        nodeShape: shape,
      })),
    );
  const graphs = [shapesGraph, dataGraph];
  return pairs.filter(
    (pair) =>
      !isAbstract(pair.nodeShape, graphs) ||
      !pairs.some(
        (other) => other.focusNode.equals(pair.focusNode) && !isAbstract(other.nodeShape, graphs),
      ),
  );
}

/**
 * `shapes` (all targeting one focus node) without the dash:abstract ones, unless that would leave
 * nothing. An instance of a concrete subclass is a SHACL instance of its abstract superclass too,
 * so both shapes target it - but the abstract one only exists to be specialized (and its
 * properties already come along with the concrete shape, see withSuperClassShapes), so offering it
 * as a pair of its own would render the same resource twice. When no concrete shape targets the
 * node (e.g. data typed with the abstract class directly), the abstract shape is still the best
 * description there is and stays.
 */
function preferConcreteShapes(shapes: Quad_Subject[], graphs: RdfStore[]): Quad_Subject[] {
  const concrete = shapes.filter((shape) => !isAbstract(shape, graphs));
  return concrete.length > 0 ? concrete : shapes;
}
