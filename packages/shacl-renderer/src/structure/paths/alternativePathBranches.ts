import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";

/**
 * The branch predicates of a top-level sh:alternativePath whose every branch is a plain predicate
 * (e.g. `sh:alternativePath (dc:title rdfs:label)`) - the only shape of alternative path this
 * codebase can write through unambiguously, since each branch then names exactly one place a value
 * could live. Returns undefined for anything else: a path that isn't an alternative at all, or an
 * alternative with at least one branch that is itself a sequence/inverse/nested alternative -
 * equally valid SHACL, but with no single write target, the same limitation
 * insertPropertyPath/replacePropertyPath/removePropertyPath already apply to sh:zeroOrMorePath/
 * sh:oneOrMorePath/sh:zeroOrOnePath. An empty sh:alternativePath list also returns undefined: zero
 * branches is zero write targets, not one deterministic one.
 */
export function switchableAlternativeBranches(path: PropertyPath): NamedNode[] | undefined {
  if (path.type !== "alternative" || path.items.length === 0) return undefined;

  const branches: NamedNode[] = [];
  for (const item of path.items) {
    if (item.type !== "predicate") return undefined;
    branches.push(item.predicate);
  }
  return branches;
}

/**
 * Which of `branches` already holds `value` on `focusNode` - unambiguous by construction: a value
 * already asserted through one branch's predicate is definitionally "in" that branch. Mirrors
 * resolution/label.ts's resolveLabelRolePathParts, the existing precedent for walking an
 * alternative path's branches one at a time rather than through walkPropertyPath's own
 * merged-across-all-branches traversal.
 */
export function branchHoldingValue(
  branches: NamedNode[],
  focusNode: Quad_Subject,
  dataGraph: RdfStore,
  value: Term,
): NamedNode | undefined {
  return branches.find((branch) =>
    walkPropertyPath({ type: "predicate", predicate: branch }, focusNode, dataGraph).some((term) =>
      term.equals(value)
    )
  );
}

/**
 * Which branch a brand new value (not yet reachable through any branch) should be written to:
 * whichever branch already has at least one existing value on `focusNode` (declaration order), so
 * a property that's already "settled" on one branch keeps adding there rather than splitting
 * across branches - falling back to the first declared branch when the property has no values at
 * all yet.
 */
export function defaultWriteBranch(
  branches: NamedNode[],
  focusNode: Quad_Subject,
  dataGraph: RdfStore,
): NamedNode {
  return (
    branches.find(
      (branch) =>
        walkPropertyPath({ type: "predicate", predicate: branch }, focusNode, dataGraph).length > 0
    ) ?? branches[0]
  );
}
