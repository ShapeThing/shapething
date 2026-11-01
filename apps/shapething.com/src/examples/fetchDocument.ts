import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import type { DatasetCore, NamedNode, Quad } from "@rdfjs/types";
import { ResourceFetcher, type DebugEvent } from "@shapething/resource-fetcher";
import { DataFactory, Parser, Store } from "n3";
import { getExampleStore } from "./exampleStore";
import shapesTurtle from "./shapes.ttl?raw";

const engine = new QueryEngine();

export const shapesQuads = new Parser().parse(shapesTurtle);
const shapesGraph = new Store(shapesQuads);

export const ex = (localName: string) => DataFactory.namedNode(`http://example.org/${localName}`);

export const queryBindings = async (query: string) => {
  const { source } = getExampleStore();
  return (
    await engine.queryBindings(query, { sources: [source], unionDefaultGraph: true })
  ).toArray();
};

/**
 * Fetches one document from the example store with the ResourceFetcher, optionally guided by a shape.
 * The shape is looked up in shapes.ttl unless other shapes are given.
 * The quads are returned without their graph, the document is the resource and its blank nodes.
 */
export const fetchDocument = async (
  resource: NamedNode,
  {
    shape,
    shapes = shapesGraph,
    onQuery,
  }: {
    shape?: NamedNode;
    shapes?: DatasetCore;
    onQuery?: (query: string, step: number, resource: NamedNode) => void;
  } = {},
) => {
  // Linked resources that a shape follows with sh:node are fetched by a nested ResourceFetcher, its queries come in one event.
  const report = (event: DebugEvent, resource: NamedNode) => {
    if (event.type === "query") onQuery?.(event.query, event.step, resource);
    if (event.type === "nested-fetch") {
      for (const nested of event.events) report(nested, DataFactory.namedNode(event.resourceIri));
    }
  };

  const fetcher = new ResourceFetcher({
    resourceIri: resource,
    queryBindings,
    ...(shape ? { shapesGraph: shapes, shapeIris: shape } : {}),
    debug: (event) => report(event, resource),
  });
  const { results, steps } = await fetcher.execute();
  return {
    steps,
    quads: results.map((quad) =>
      DataFactory.quad(quad.subject, quad.predicate, quad.object),
    ) as Quad[],
  };
};
