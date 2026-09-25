import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { sparqlFilterForBucket, type ColorBucket } from "@/helpers/colorBuckets.ts";
import { geof, rdf, rdfs, sh, st } from "@/helpers/namespaces.ts";
import { escapeSparqlLiteral, termToSparql } from "@/helpers/sparqlLiteral.ts";
import { descendantClasses } from "@/resolution/targets.ts";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import {
  classClosure,
  filterConstraintNodes,
  readFilterConstraint,
  hasFilterConstraint,
  type FilterShape,
} from "@/facets/filterShape.ts";

/**
 * Compiles facet mode's two inputs - which root shapes are active (their SHACL targets) and the
 * generated filter shape (facets/filterShape.ts) - into SPARQL graph patterns over `?this`, so
 * every facet question (option values, counts, range bounds, matching instances) is one query
 * through Comunica, against either the local dataGraph or a remote SPARQL endpoint
 * (Environment.facetsEndpoint). See facets/facetQueries.ts for the queries built on top.
 *
 * Nothing here ever enumerates instances - that's the point: an endpoint can hold far more than
 * could ever be pulled into the browser, so "which instances" stays a pattern the endpoint
 * evaluates, never a list.
 */

export type CompileOptions = {
  // The graph(s) whose rdfs:subClassOf triples decide a class target's/class pick's subclass
  // closure. The taxonomy normally lives in the shapes graph; the local dataGraph is searched too
  // when it's the query source (mirroring resolution/targets.ts's descendantClasses), an endpoint's
  // own ontology isn't (it's inlined as a VALUES list, not walked with rdfs:subClassOf*).
  classGraphs: RdfStore[];
};

/**
 * The union of every target (SHACL 3.1.3) of `rootShapes`, as a pattern binding `?this` - the
 * query-side counterpart of resolution/targets.ts's targetsOfShape. sh:targetWhere is out of scope
 * there and here alike. A shape with no usable target contributes nothing; no targets at all
 * compiles to a pattern matching nothing.
 */
export function compileTargets(
  rootShapes: Quad_Subject[],
  shapesGraph: RdfStore,
  options: CompileOptions,
): string {
  const branches: string[] = [];

  const classBranch = (classTerm: Term) => {
    const classes = descendantClasses(classTerm, options.classGraphs)
      .map(termToSparql)
      .filter((value): value is string => value !== undefined);
    if (classes.length === 1) branches.push(`?this a ${classes[0]} .`);
    else if (classes.length > 1) branches.push(`?this a ?thisType . VALUES ?thisType { ${classes.join(" ")} }`);
  };

  for (const shape of rootShapes) {
    const nodes = shapesGraph
      .getQuads(shape, sh("targetNode"))
      .map((quad) => termToSparql(quad.object))
      .filter((value): value is string => value !== undefined);
    if (nodes.length > 0) branches.push(`VALUES ?this { ${nodes.join(" ")} }`);

    for (const quad of shapesGraph.getQuads(shape, sh("targetClass"))) classBranch(quad.object);

    const isShapeClass = shapesGraph.getQuads(shape, rdf("type"), sh("ShapeClass")).length > 0;
    const isExplicitShapeAndClass =
      (shapesGraph.getQuads(shape, rdf("type"), sh("NodeShape")).length > 0 ||
        shapesGraph.getQuads(shape, rdf("type"), sh("PropertyShape")).length > 0) &&
      shapesGraph.getQuads(shape, rdf("type"), rdfs("Class")).length > 0;
    if (isShapeClass || isExplicitShapeAndClass) classBranch(shape);

    for (const quad of shapesGraph.getQuads(shape, sh("targetSubjectsOf"))) {
      if (quad.object.termType === "NamedNode") branches.push(`?this <${quad.object.value}> [] .`);
    }
    for (const quad of shapesGraph.getQuads(shape, sh("targetObjectsOf"))) {
      if (quad.object.termType === "NamedNode") branches.push(`[] <${quad.object.value}> ?this .`);
    }
    if (shape.termType === "NamedNode") branches.push(`?this <${sh("shape").value}> <${shape.value}> .`);
  }

  const unique = [...new Set(branches)];
  if (unique.length === 0) return "FILTER(false)";
  if (unique.length === 1) return unique[0];
  return unique.map((branch) => `{ ${branch} }`).join(" UNION ");
}

/**
 * Every constraint currently on `filterShape` except the one(s) on `excludePath` (a toSparql()
 * path string - typically the asking facet's own, so multi-selecting inside one facet doesn't
 * shrink its own sibling options' counts), joined into one pattern that narrows `?this`. Empty
 * string when nothing applies.
 */
export function compileFilter(
  filterShape: FilterShape,
  options: CompileOptions & { excludePath?: string },
): string {
  const { store } = filterShape;
  return filterConstraintNodes(filterShape)
    .flatMap((node, index) => {
      const path = parsePropertyPath(node, store);
      if (!path) return [];
      const pathSparql = toSparql(path);
      if (options.excludePath !== undefined && pathSparql === options.excludePath) return [];
      const pattern = compileConstraint(filterShape, node, pathSparql, `filter${index}`, options);
      return pattern ? [pattern] : [];
    })
    .join("\n");
}

/**
 * One sh:property constraint node as a pattern over `?this`: "some value on this path satisfies
 * every one of the node's constraints" - the same meaning the node's sh:qualifiedValueShape/
 * sh:qualifiedMinCount 1 has as SHACL (see FilterShape). `prefix` keeps each constraint's own
 * variables from colliding with any other part of the enclosing query.
 */
function compileConstraint(
  filterShape: FilterShape,
  node: Quad_Subject,
  pathSparql: string,
  prefix: string,
  options: CompileOptions,
): string | undefined {
  const value = `?${prefix}Value`;
  const read = (predicate: Parameters<typeof readFilterConstraint>[2]) =>
    readFilterConstraint(filterShape, node, predicate);
  const conditions: string[] = [];
  const extraPatterns: string[] = [];

  if (hasFilterConstraint(filterShape, node, sh("in"))) {
    const members = read(sh("in"))
      .map(termToSparql)
      .filter((term): term is string => term !== undefined);
    conditions.push(members.length > 0 ? `${value} IN (${members.join(", ")})` : "false");
  }

  const pattern = read(sh("pattern"))[0];
  if (pattern) {
    const flags = read(sh("flags"))[0];
    conditions.push(
      `REGEX(STR(${value}), "${escapeSparqlLiteral(pattern.value)}"${
        flags ? `, "${escapeSparqlLiteral(flags.value)}"` : ""
      })`,
    );
  }

  for (const [predicate, operator] of [
    [sh("minInclusive"), ">="],
    [sh("maxInclusive"), "<="],
    [sh("minExclusive"), ">"],
    [sh("maxExclusive"), "<"],
  ] as const) {
    const bound = read(predicate)[0];
    const boundSparql = bound && termToSparql(bound);
    if (boundSparql) conditions.push(`${value} ${operator} ${boundSparql}`);
  }

  const classIn = read(st("classIn"));
  if (classIn.length > 0 || hasFilterConstraint(filterShape, node, st("classIn"))) {
    const allowed = [
      ...new Set(options.classGraphs.flatMap((graph) => classClosure(classIn, graph))),
    ];
    extraPatterns.push(
      allowed.length > 0
        ? `VALUES ${value} { ${allowed.map((iri) => `<${iri}>`).join(" ")} }`
        : "FILTER(false)",
    );
  }

  const bucket = read(st("colorBucket"))[0];
  if (bucket) {
    extraPatterns.push(
      `${value} <${st("hue").value}> ?${prefix}hue ; <${st("saturation").value}> ?${prefix}sat ; <${st("lightness").value}> ?${prefix}light .`,
    );
    conditions.push(prefixBucketVariables(sparqlFilterForBucket(bucket.value as ColorBucket), prefix));
  }

  const area = read(st("withinArea"))[0];
  const areaSparql = area && termToSparql(area);
  if (areaSparql) conditions.push(`<${geof("sfWithin").value}>(${value}, ${areaSparql})`);

  if (conditions.length === 0 && extraPatterns.length === 0) return undefined;

  const body = [
    `?this ${pathSparql} ${value} .`,
    ...extraPatterns,
    ...(conditions.length > 0 ? [`FILTER(${conditions.map((c) => `(${c})`).join(" && ")})`] : []),
  ].join(" ");

  // Comunica evaluates a FILTER EXISTS containing an extension function (geof:sfWithin) against the
  // wrong outer binding, so an area constraint is a plain join instead: it can repeat ?this once per
  // matching value, which every query built on these patterns absorbs (COUNT(DISTINCT ?this),
  // SELECT DISTINCT ?this, MIN/MAX).
  return areaSparql ? `{ ${body} }` : `FILTER EXISTS { ${body} }`;
}

// sparqlFilterForBucket speaks in fixed ?hue/?sat/?light variables - renamed per constraint so two
// color constraints (or a color facet's own bucket query) never correlate through a shared name.
export function prefixBucketVariables(filter: string, prefix: string): string {
  return filter.replace(/\?(hue|sat|light)\b/g, `?${prefix}$1`);
}
