import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { rdf, rdfs, sh } from "@/helpers/namespaces.ts";
import { getRdfList } from "@/helpers/rdfList.ts";
import { termKey } from "@/helpers/termKey.ts";
import { validate } from "@/scoring/score.ts";

/**
 * Every class reachable from `classIri` by walking rdfs:subClassOf downward (i.e. every subclass,
 * transitively), plus `classIri` itself - the class-hierarchy half of the spec's "SHACL instance"
 * definition that 3.1.3.2/3.1.3.3 build on. The spec's own note on class-based targets says
 * rdfs:subClassOf triples are normatively expected in the data graph but may also be queried from
 * the shapes graph - this codebase's own fixtures generally declare ontology structure in the
 * shapes graph instead (see SubClassEditor's own downward walk), so both are searched here.
 * Cycle-safe: a class already seen is never re-queried, so a cyclical subClassOf graph terminates.
 */
function descendantClasses(classIri: Term, graphs: RdfStore[]): Term[] {
  const seen = new Set<string>([classIri.value]);
  const result: Term[] = [classIri];
  let frontier = [classIri];

  while (frontier.length > 0) {
    const next: Term[] = [];
    for (const node of frontier) {
      for (const graph of graphs) {
        for (const quad of graph.getQuads(null, rdfs("subClassOf"), node)) {
          if (seen.has(quad.subject.value)) continue;
          seen.add(quad.subject.value);
          result.push(quad.subject);
          next.push(quad.subject);
        }
      }
    }
    frontier = next;
  }

  return result;
}

/**
 * 3.1.3.2 Class-based Targets' core building block: every SHACL instance of `classIri` in
 * `dataGraph` - every node with an rdf:type triple whose object is `classIri` itself or one of its
 * (transitive) rdfs:subClassOf descendants. Reusable directly by anything that needs "existing
 * instances of a class" without going through a shape's own sh:targetClass declaration at all
 * (e.g. InstancesSelectEditor's/AutoCompleteEditor's own instance pickers, which key off a
 * property's sh:class instead) - not just targetsOfShape below.
 */
export function shaclInstancesOfClass(
  classIri: Term,
  dataGraph: RdfStore,
  shapesGraph: RdfStore,
): Quad_Subject[] {
  const classes = descendantClasses(classIri, [dataGraph, shapesGraph]);
  return dedupeTerms(
    classes.flatMap((classTerm) =>
      dataGraph.getQuads(null, rdf("type"), classTerm).map((quad) => quad.subject),
    ),
  ) as Quad_Subject[];
}

/** Every shape node in `shapesGraph` that declares `sh:targetClass classIri` directly (3.1.3.2). */
export function shapesTargetingClass(classIri: Term, shapesGraph: RdfStore): Quad_Subject[] {
  return shapesGraph.getQuads(null, sh("targetClass"), classIri).map((quad) => quad.subject);
}

/**
 * 3.1.3 Targets: the full target node set of `shapeNode` - every kind of target declaration SHACL
 * Core defines, except 3.1.3.6 (sh:targetWhere, see below). This is the one place in the codebase
 * that should compute "what does this shape apply to" - callers that only need one specific slice
 * of it (e.g. label.ts's "which shape describes values of this class" reverse lookup, or a picker
 * widget's "which existing nodes could I offer") should still prefer shaclInstancesOfClass/
 * shapesTargetingClass above directly rather than re-deriving their own graph-pattern queries.
 *
 * 3.1.3.6 (sh:targetWhere) is deliberately not covered here: unlike the other five kinds, a where
 * target's value is itself a shape (spec: "the set of nodes in a data graph DG that conform to w"),
 * so establishing whether one candidate conforms means real SHACL shape validation via a
 * shacl-engine Engine, not a plain graph-pattern lookup - and discovering the *whole* target set
 * would mean checking every dataGraph candidate against it (the spec's own performance note flags
 * this as the expensive case). See shapesWhereTargetingFocusNode below for the one-known-candidate
 * case every current caller actually needs instead.
 */
export function targetsOfShape(
  shapeNode: Quad_Subject,
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
): Term[] {
  const targets: Term[] = [];

  // 3.1.3.1 Node targets
  for (const quad of shapesGraph.getQuads(shapeNode, sh("targetNode"))) targets.push(quad.object);

  // 3.1.3.2 Class-based targets
  for (const quad of shapesGraph.getQuads(shapeNode, sh("targetClass"))) {
    targets.push(...shaclInstancesOfClass(quad.object, dataGraph, shapesGraph));
  }

  // 3.1.3.3 Implicit class targets (shapeNode is itself both a shape and a class) and sh:ShapeClass
  // (a syntactic shortcut for the same pattern - itself a subclass of both sh:NodeShape and
  // rdfs:Class, so a node merely typed sh:ShapeClass doesn't need a separate explicit sh:NodeShape/
  // rdfs:Class typing of its own).
  const isShapeClass = shapesGraph.getQuads(shapeNode, rdf("type"), sh("ShapeClass")).length > 0;
  const isExplicitShapeAndClass =
    (shapesGraph.getQuads(shapeNode, rdf("type"), sh("NodeShape")).length > 0 ||
      shapesGraph.getQuads(shapeNode, rdf("type"), sh("PropertyShape")).length > 0) &&
    shapesGraph.getQuads(shapeNode, rdf("type"), rdfs("Class")).length > 0;
  if (isShapeClass || isExplicitShapeAndClass) {
    targets.push(...shaclInstancesOfClass(shapeNode, dataGraph, shapesGraph));
  }

  // 3.1.3.4 Subjects-of targets
  for (const quad of shapesGraph.getQuads(shapeNode, sh("targetSubjectsOf"))) {
    if (quad.object.termType !== "NamedNode") continue;
    for (const dataQuad of dataGraph.getQuads(null, quad.object)) targets.push(dataQuad.subject);
  }

  // 3.1.3.5 Objects-of targets
  for (const quad of shapesGraph.getQuads(shapeNode, sh("targetObjectsOf"))) {
    if (quad.object.termType !== "NamedNode") continue;
    for (const dataQuad of dataGraph.getQuads(null, quad.object)) targets.push(dataQuad.object);
  }

  // 3.1.3.7 Explicit shape targets (sh:shape, declared in the DATA graph, pointing at this shape)
  for (const quad of dataGraph.getQuads(null, sh("shape"), shapeNode)) targets.push(quad.subject);

  return dedupeTerms(targets);
}

/**
 * Reverse lookup of targetsOfShape: every shape node in `shapesGraph` whose target set (3.1.3)
 * includes `node` - i.e. every shape that already applies to this one known node, rather than
 * "what does this shape apply to". Used by LabelViewer's Environment.enableViewInPlace to decide
 * whether an IRI value has a shape to render read-only in a modal, before bothering to build a
 * NodeUIElement for it.
 *
 * Candidate shapes are gathered from every SHACL Core predicate that can declare a target
 * (typing a shape sh:NodeShape/sh:PropertyShape alone doesn't - a shape only actually targets
 * something via one of these), then each candidate's full target set is checked for `node`.
 */
export function shapesTargetingNode(
  node: Term,
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
): Quad_Subject[] {
  const candidateShapes = dedupeTerms([
    ...shapesGraph.getQuads(null, sh("targetClass")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetNode")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetSubjectsOf")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetObjectsOf")).map((quad) => quad.subject),
    ...dataGraph.getQuads(null, sh("shape")).map((quad) => quad.object),
  ]) as Quad_Subject[];

  return candidateShapes.filter((shapeNode) =>
    targetsOfShape(shapeNode, shapesGraph, dataGraph).some((target) => target.equals(node)),
  );
}

/**
 * 3.1.3.6 Where Targets (sh:targetWhere), for one already-known candidate node - the sibling
 * shapesTargetingNode above deliberately excludes: every shape `s` in `shapesGraph` that declares
 * `sh:targetWhere w` where `focusNode` conforms to `w` (the where-target's value is itself a
 * shape - spec: "the set of nodes ... that conform to w" - not a SPARQL pattern despite the
 * predicate's name). Conformance is checked via validate() (scoring/score.ts), the same
 * shacl-engine-backed helper structure/choiceBranches.ts's detectActiveChoiceBranch uses to test a
 * focus node against a candidate branch shape - this is that same one-node check, just against
 * every sh:targetWhere value in the shapes graph instead of one sh:or/sh:xone's branch list.
 */
export async function shapesWhereTargetingFocusNode(
  focusNode: Term,
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
): Promise<Quad_Subject[]> {
  const declarations = shapesGraph.getQuads(null, sh("targetWhere"));
  if (declarations.length === 0) return [];

  const matches: Quad_Subject[] = [];
  for (const quad of declarations) {
    const conforms = await validate({
      focusNode,
      targetGraph: dataGraph,
      shapeNode: quad.object,
      shapesGraph,
    });
    if (conforms) matches.push(quad.subject as Quad_Subject);
  }
  return dedupeTerms(matches) as Quad_Subject[];
}

/**
 * Every predicate a sh:targetWhere value shape directly inspects via sh:property/sh:path (walking
 * sh:and/sh:node the same way structure/childrenForShape.ts does, so a value shape built out of
 * other composed shapes is covered too). Lets a caller re-run shapesWhereTargetingFocusNode only
 * when a write could plausibly change its answer, instead of on every write touching the focus
 * node at all - see outputs/render/hooks/useTargetWhereFragments.tsx, the one caller.
 *
 * Deliberately conservative, not a full dependency solver: a sh:targetWhere value using a
 * construct with no sh:path at all (e.g. a bare sh:class check, or a SPARQL-based constraint) is
 * invisible to this walk and contributes no predicates for it. Callers must treat an empty result
 * as "couldn't narrow it down", not "this shape never changes", and fall back to broad tracking.
 */
export function predicatesReferencedByTargetWhereShapes(shapesGraph: RdfStore): NamedNode[] {
  const declarations = shapesGraph.getQuads(null, sh("targetWhere"));
  if (declarations.length === 0) return [];

  const visited = new Set<string>();
  const predicates: NamedNode[] = [];

  function walk(shapeNode: Term): void {
    const key = termKey(shapeNode);
    if (visited.has(key)) return;
    visited.add(key);

    for (const quad of shapesGraph.getQuads(shapeNode, sh("property"))) {
      for (const pathQuad of shapesGraph.getQuads(quad.object, sh("path"))) {
        if (pathQuad.object.termType === "NamedNode") predicates.push(pathQuad.object);
      }
    }

    for (const listQuad of shapesGraph.getQuads(shapeNode, sh("and"))) {
      for (const branchShape of getRdfList(listQuad.object, shapesGraph)) walk(branchShape);
    }

    for (const nodeQuad of shapesGraph.getQuads(shapeNode, sh("node"))) walk(nodeQuad.object);
  }

  for (const quad of declarations) walk(quad.object);

  return dedupeTerms(predicates) as NamedNode[];
}

/**
 * Every "root" shape in `shapesGraph` - every shape declaring an explicit target (3.1.3.1/.2/.4/.5)
 * plus every implicit class-shape (3.1.3.3: a node that's both a shape and a class, or typed
 * sh:ShapeClass) - regardless of whether any actual data conforms to it yet. Facet mode's entry
 * point (unlike edit/view, which always start from one known focusNode) has no focus node to
 * discover shapes *from* - it instead needs every shape a dataset COULD be filtered by, found by
 * walking the whole shapes graph once up front. Deliberately excludes 3.1.3.7 (sh:shape, declared
 * per data-graph node) - that describes one existing node's own shape, not a standalone "kind of
 * thing" worth offering as a facetable root.
 */
export function facetableRootShapes(shapesGraph: RdfStore): Quad_Subject[] {
  const explicitTargetShapes = [
    ...shapesGraph.getQuads(null, sh("targetClass")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetNode")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetSubjectsOf")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetObjectsOf")).map((quad) => quad.subject),
  ];

  const implicitClassShapes = shapesGraph
    .getQuads(null, rdf("type"), rdfs("Class"))
    .map((quad) => quad.subject)
    .filter(
      (node) =>
        shapesGraph.getQuads(node, rdf("type"), sh("NodeShape")).length > 0 ||
        shapesGraph.getQuads(node, rdf("type"), sh("PropertyShape")).length > 0,
    );

  const shapeClasses = shapesGraph
    .getQuads(null, rdf("type"), sh("ShapeClass"))
    .map((quad) => quad.subject);

  return dedupeTerms([
    ...explicitTargetShapes,
    ...implicitClassShapes,
    ...shapeClasses,
  ]) as Quad_Subject[];
}
