import type { Term } from "@rdfjs/types";
import { useQuery } from "@tanstack/react-query";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { termKey } from "@/helpers/termKey.ts";
import { detectActiveBranch, type LogicalBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * The query behind useActiveBranch - also run (via queryClient.fetchQuery: same key, same cache
 * entry) by useSlotResolution, which composes it with widget resolution into a single query.
 */
export function activeBranchQueryOptions(
  property: PropertyUIElement,
  term: Term,
  branches: LogicalBranch[],
) {
  return {
    queryKey: [
      "active-branch",
      property.propertyShapes.map((shape) => shape.value),
      termKey(term),
      branches.map((branch) => branch.shape.value),
    ],
    queryFn: async (): Promise<LogicalBranch | null> =>
      branches.length > 0 ? ((await detectActiveBranch(property, term, branches)) ?? null) : null,
    ...noRefetch,
  };
}

/**
 * Which sh:or/sh:xone branch `term` currently conforms to, re-derived from the data itself
 * rather than kept as separate UI state - see detectActiveBranch().
 */
export function useActiveBranch(
  property: PropertyUIElement,
  term: Term,
  branches: LogicalBranch[],
): LogicalBranch | undefined {
  const { data } = useQuery(activeBranchQueryOptions(property, term, branches));
  return data ?? undefined;
}
