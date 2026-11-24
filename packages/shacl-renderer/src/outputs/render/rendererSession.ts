import type { QueryClient } from "@tanstack/react-query";
import type { RdfStore } from "rdf-stores";
import type { Environment } from "@/environment.ts";

/**
 * Carries a renderer's caches over from one focusNode to the next (see render.tsx). A new
 * focusNode still gets a fresh QueryClient and a freshly preprocessed Environment, but when that
 * Environment's graphs hold exactly the same quads as the previous one's (preprocessing is
 * deterministic: the same Turtle parses to the same blank nodes, generated shapes are named after
 * their shape and path), it takes over the previous stores, and the new QueryClient is seeded with
 * the previous one's results. Everything cached per store (scoring's validation results, compiled
 * SHACL engines, structure/memo.ts) and per query key (widget picks, active branches, ...) then
 * still fits: it is derived from those very graphs, and nothing in a query depends on the
 * focusNode without saying so in its key.
 *
 * When any graph differs (e.g. missing shapes generated from the new focusNode's own predicates),
 * nothing is carried over: the renderer starts from scratch, as it would without this.
 */

const SHARED_GRAPHS = ["shapesGraph", "dataGraph", "scoresGraph"] as const;

type Graphs = Pick<Environment, (typeof SHARED_GRAPHS)[number]>;

// The graphs of the Environment each QueryClient's results were derived from.
const sessions = new WeakMap<QueryClient, Graphs>();

function sameQuads(a: RdfStore, b: RdfStore): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const quad of a.getQuads()) {
    if (b.countQuads(quad.subject, quad.predicate, quad.object, quad.graph) === 0) return false;
  }
  return true;
}

// Not carried over: the Environment itself, which belongs to the previous focusNode.
const OWN_QUERIES = new Set(["preprocess-environment"]);

/**
 * The Environment to render with on `queryClient`: `environment`, or - when its graphs equal those
 * `previousClient`'s results were derived from - `environment` on those very graphs, with
 * `queryClient` seeded from `previousClient`.
 */
export function continueSession(
  queryClient: QueryClient,
  previousClient: QueryClient | undefined,
  environment: Environment,
): Environment {
  const previous = previousClient && sessions.get(previousClient);
  let next = environment;
  if (previous && SHARED_GRAPHS.every((graph) => sameQuads(previous[graph], environment[graph]))) {
    next = {
      ...environment,
      shapesGraph: previous.shapesGraph,
      dataGraph: previous.dataGraph,
      scoresGraph: previous.scoresGraph,
    };
    for (const query of previousClient.getQueryCache().getAll()) {
      if (query.state.status !== "success" || OWN_QUERIES.has(query.queryKey[0] as string))
        continue;
      if (queryClient.getQueryState(query.queryKey)) continue;
      queryClient.setQueryData(query.queryKey, query.state.data, {
        updatedAt: query.state.dataUpdatedAt,
      });
    }
  }
  sessions.set(queryClient, {
    shapesGraph: next.shapesGraph,
    dataGraph: next.dataGraph,
    scoresGraph: next.scoresGraph,
  });
  return next;
}
