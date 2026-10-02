import type { Literal, NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { severityRank } from "@/helpers/worstSeverity.ts";
import { localName } from "@/helpers/localName.ts";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import { shapesTargetingNode } from "@/resolution/targets.ts";
import { insertPropertyPath } from "@/structure/paths/insertPropertyPath.ts";
import { removePropertyPath } from "@/structure/paths/removePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { parsePathNode, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import { writePropertyPath } from "@/structure/paths/writePropertyPath.ts";

/**
 * One sh:ValidationResult as read straight off a validation report graph (SHACL 1.2 Core, 3.6.2).
 * Only sh:focusNode, sh:resultSeverity and sh:sourceConstraintComponent are mandatory there -
 * everything else may be absent.
 */
export type ReportResult = {
  focusNode: Quad_Subject;
  path?: PropertyPath;
  value?: Term;
  severity: Term;
  messages: Literal[];
  sourceShape?: Term;
  constraintComponent?: Term;
  details: ReportResult[];
};

export type ParsedReport = {
  // Undefined only for a malformed report with no sh:conforms at all.
  conforms?: boolean;
  results: ReportResult[];
};

const first = (graph: RdfStore, subject: Term, predicate: NamedNode) =>
  graph.getQuads(subject, predicate)[0]?.object;

function readResult(graph: RdfStore, node: Term, visiting: Set<string>): ReportResult | undefined {
  const focusNode = first(graph, node, sh("focusNode"));
  if (!focusNode || focusNode.termType === "Literal") return undefined;

  const pathNode = first(graph, node, sh("resultPath"));
  let path: PropertyPath | undefined;
  if (pathNode) {
    try {
      path = parsePathNode(pathNode, graph);
    } catch {
      // A malformed sh:resultPath - the result still renders, just at the focus node itself.
    }
  }

  // sh:detail may nest further results (3.6.2.7); guarded against a cyclic report.
  const key = termKey(node);
  visiting.add(key);
  const details = graph
    .getQuads(node, sh("detail"))
    .map((quad) => quad.object)
    .filter((detail) => !visiting.has(termKey(detail)))
    .map((detail) => readResult(graph, detail, visiting))
    .filter((detail): detail is ReportResult => detail !== undefined);
  visiting.delete(key);

  return {
    focusNode: focusNode as Quad_Subject,
    path,
    value: first(graph, node, sh("value")),
    severity: first(graph, node, sh("resultSeverity")) ?? sh("Violation"),
    messages: graph
      .getQuads(node, sh("resultMessage"))
      .map((quad) => quad.object)
      .filter((term): term is Literal => term.termType === "Literal"),
    sourceShape: first(graph, node, sh("sourceShape")),
    constraintComponent: first(graph, node, sh("sourceConstraintComponent")),
    details,
  };
}

/**
 * Every sh:ValidationReport in `graph` (the spec allows exactly one, more are tolerated and
 * combined) and its sh:result values.
 */
export function parseValidationReport(graph: RdfStore): ParsedReport {
  const reports = graph
    .getQuads(null, rdf("type"), sh("ValidationReport"))
    .map((quad) => quad.subject);
  const conformsValues = reports
    .map((report) => first(graph, report, sh("conforms"))?.value)
    .filter((value): value is string => value !== undefined);
  const results = reports
    .flatMap((report) => graph.getQuads(report, sh("result")).map((quad) => quad.object))
    .map((node) => readResult(graph, node, new Set()))
    .filter((result): result is ReportResult => result !== undefined);

  return {
    conforms: conformsValues.length ? conformsValues.every((value) => value === "true") : undefined,
    results,
  };
}

/** One focus node of a report, with the generated node shape that renders it. */
export type ReportFocusNode = {
  focusNode: Quad_Subject;
  // Generated per focus node: an sh:property for exactly the property shapes its results matched
  // (or were generated for), so rendering it shows only the affected properties - with their own
  // sh:name/sh:group/sh:order wherever the real shape was found.
  nodeShape: Quad_Subject;
  // Results that belong to the focus node itself rather than to one of its properties - those
  // without a sh:resultPath (e.g. sh:class or sh:node on a node shape).
  nodeResults: ValidationResult[];
};

export type ResolvedReport = {
  conforms?: boolean;
  focusNodes: ReportFocusNode[];
  // Property-level results, each with its sourceShape set to the property shape it renders under.
  results: ValidationResult[];
};

const pathKey = (path: PropertyPath) => toSparql(path);

const isPropertyShape = (term: Term, shapesGraph: RdfStore) =>
  shapesGraph.getQuads(term, sh("path")).length > 0;

const isNodeShapeLike = (term: Term, shapesGraph: RdfStore) =>
  !isPropertyShape(term, shapesGraph) && shapesGraph.getQuads(term, null).length > 0;

function propertyShapesWithPath(
  key: string,
  candidates: Term[],
  shapesGraph: RdfStore,
): Quad_Subject | undefined {
  for (const propertyShape of candidates) {
    const pathNode = first(shapesGraph, propertyShape, sh("path"));
    if (!pathNode) continue;
    try {
      if (pathKey(parsePathNode(pathNode, shapesGraph)) === key) return propertyShape as Quad_Subject;
    } catch {
      // A malformed sh:path can't match anything.
    }
  }
  return undefined;
}

/**
 * Maps a parsed report onto shapesGraph: each result is attached to the property shape it renders
 * under - its sh:sourceShape when shapesGraph has it, otherwise the property shape with an equal
 * sh:path among the shapes that apply to the focus node (a blank-node sh:sourceShape from a report
 * serialized on its own never matches the shapes graph's own blank nodes), otherwise a property
 * shape generated from sh:resultPath alone (a deep copy of the original sh:path, per 3.6.2.2).
 *
 * Writes the generated shapes into `shapesGraph`, and the reported values into `dataGraph`: the
 * report is a snapshot of the data as it was validated, so for every property it reports values
 * for, those values replace whatever `dataGraph` holds there now (the data may have changed since).
 * A property whose results carry no sh:value (sh:minCount, sh:maxCount, sh:uniqueLang, ...) keeps
 * dataGraph's own values - the report doesn't say which values it was about. Both graphs are
 * expected to be the caller's own copies.
 */
export function resolveReport(
  report: ParsedReport,
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
): ResolvedReport {
  const allPropertyShapes = dedupeTerms(
    shapesGraph.getQuads(null, sh("path")).map((quad) => quad.subject),
  );
  const generatedByPath = new Map<string, Quad_Subject>();
  const generated = new Set<string>();

  const generatedPropertyShape = (path: PropertyPath): Quad_Subject => {
    const key = pathKey(path);
    let shape = generatedByPath.get(key);
    if (!shape) {
      shape = factory.blankNode();
      shapesGraph.addQuad(factory.quad(shape, rdf("type"), sh("PropertyShape")));
      shapesGraph.addQuad(
        factory.quad(shape, sh("path"), writePropertyPath(path, shapesGraph) as Quad_Subject),
      );
      generatedByPath.set(key, shape);
      generated.add(termKey(shape));
    }
    return shape;
  };

  // The shape whose parameters describe what went wrong (sh:minCount's value, ...) - only when
  // shapesGraph actually holds it.
  const constraintShapeFor = (result: ReportResult, propertyShape?: Term): Term | undefined => {
    if (result.sourceShape && shapesGraph.getQuads(result.sourceShape, null).length > 0) {
      return result.sourceShape;
    }
    return propertyShape && !generated.has(termKey(propertyShape)) ? propertyShape : undefined;
  };

  const propertyShapeFor = (result: ReportResult): Quad_Subject | undefined => {
    if (!result.path) return undefined;
    if (result.sourceShape && isPropertyShape(result.sourceShape, shapesGraph)) {
      return result.sourceShape as Quad_Subject;
    }
    const key = pathKey(result.path);
    // Node shapes that plausibly produced this result: its own sh:sourceShape when that's a node
    // shape (e.g. sh:closed), else whatever targets the focus node in the (possibly empty) data.
    const nodeShapes =
      result.sourceShape && isNodeShapeLike(result.sourceShape, shapesGraph)
        ? [result.sourceShape]
        : shapesTargetingNode(result.focusNode, shapesGraph, dataGraph);
    const ownPropertyShapes = nodeShapes.flatMap((nodeShape) =>
      shapesGraph.getQuads(nodeShape, sh("property")).map((quad) => quad.object)
    );
    return (
      propertyShapesWithPath(key, ownPropertyShapes, shapesGraph) ??
      // sh:closed reports a property the node shape deliberately doesn't declare, so an unrelated
      // shape's same-path property would only mislabel it.
      (result.constraintComponent?.equals(sh("ClosedConstraintComponent"))
        ? undefined
        : propertyShapesWithPath(key, allPropertyShapes, shapesGraph)) ??
      generatedPropertyShape(result.path)
    );
  };

  const toValidationResult = (result: ReportResult): ValidationResult => {
    const propertyShape = propertyShapeFor(result);
    return {
      focusNode: result.focusNode,
      sourceShape: propertyShape,
      value: result.value,
      severity: result.severity,
      message: result.messages,
      constraintComponent: result.constraintComponent,
      constraintShape: constraintShapeFor(result, propertyShape),
      details: sortBySeverity(result.details.map(toValidationResult)),
    };
  };

  const focusNodes = new Map<string, ReportFocusNode & { propertyShapes: Quad_Subject[] }>();
  const results: ValidationResult[] = [];
  // The reported values per focus node + path, written into dataGraph once every result has been
  // matched (matching itself reads dataGraph, e.g. its rdf:type for shapesTargetingNode).
  const reportedValues = new Map<string, { focusNode: Quad_Subject; path: PropertyPath; values: Term[] }>();

  for (const reportResult of report.results) {
    const result = toValidationResult(reportResult);
    const key = termKey(reportResult.focusNode);
    let focusNode = focusNodes.get(key);
    if (!focusNode) {
      focusNode = {
        focusNode: reportResult.focusNode,
        nodeShape: factory.blankNode(),
        nodeResults: [],
        propertyShapes: [],
      };
      focusNodes.set(key, focusNode);
    }

    if (!result.sourceShape) {
      focusNode.nodeResults.push(result);
      continue;
    }
    results.push(result);
    if (!focusNode.propertyShapes.some((shape) => shape.equals(result.sourceShape))) {
      focusNode.propertyShapes.push(result.sourceShape as Quad_Subject);
    }
    if (reportResult.path && reportResult.value) {
      const valuesKey = `${key} ${pathKey(reportResult.path)}`;
      const entry = reportedValues.get(valuesKey) ??
        { focusNode: reportResult.focusNode, path: reportResult.path, values: [] };
      if (!entry.values.some((value) => value.equals(reportResult.value))) {
        entry.values.push(reportResult.value);
      }
      reportedValues.set(valuesKey, entry);
    }
  }

  for (const { focusNode, path, values } of reportedValues.values()) {
    try {
      for (const current of walkPropertyPath(path, focusNode, dataGraph)) {
        removePropertyPath(path, focusNode, dataGraph, current);
      }
      for (const value of values) insertPropertyPath(path, focusNode, dataGraph, value);
    } catch {
      // An alternative/repeatable path has no single place to put a value - dataGraph keeps its
      // own values there, and a reported value not among them shows as a property-wide message.
    }
  }

  for (const { nodeShape, propertyShapes } of focusNodes.values()) {
    shapesGraph.addQuad(factory.quad(nodeShape, rdf("type"), sh("NodeShape")));
    for (const propertyShape of propertyShapes) {
      shapesGraph.addQuad(factory.quad(nodeShape, sh("property"), propertyShape));
    }
  }

  // Worst focus node first; the report's own order otherwise (sort is stable).
  const worst = (focusNode: ReportFocusNode) =>
    Math.max(
      -1,
      ...[...focusNode.nodeResults, ...results.filter((r) => r.focusNode.equals(focusNode.focusNode))]
        .map((r) => severityRank(localName(r.severity) ?? "")),
    );
  const sortedFocusNodes = [...focusNodes.values()]
    .map(({ propertyShapes: _, ...focusNode }) => ({
      ...focusNode,
      nodeResults: sortBySeverity(focusNode.nodeResults),
    }))
    .sort((a, b) => worst(b) - worst(a));

  return { conforms: report.conforms, focusNodes: sortedFocusNodes, results: sortBySeverity(results) };
}

const sortBySeverity = (results: ValidationResult[]) =>
  [...results].sort(
    (a, b) => severityRank(localName(b.severity) ?? "") - severityRank(localName(a.severity) ?? ""),
  );

/** A fresh copy of `store`, for preprocessing to write generated triples into. */
export function copyStore(store: RdfStore): RdfStore {
  const copy = RdfStore.createDefault();
  for (const quad of store.getQuads()) copy.addQuad(quad);
  return copy;
}
