import type { Term } from "@rdfjs/types";
import { useQuery } from "@tanstack/react-query";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { detectActiveChoiceBranch } from "@/structure/choiceBranches.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";

/**
 * Which sh:or/sh:xone branch `choiceElement`'s focus node currently conforms to - the node-level
 * analogue of useActiveBranch.tsx. That hook stays reactive because its query key includes
 * termKey(term), and a single term identifies the whole property value; a node-level choice has
 * no single term to key off (its branches can span many distinct properties), so this instead
 * derives a cheap revision number from useReactiveRead, tracking every write with the focus node
 * as subject or object (mirroring validate()'s own "is focusNode missing entirely" check). This
 * only sees writes where the focus node itself is the subject/object - a branch property whose
 * own value is a further-nested sh:node (edited two levels deep) is invisible to it, same
 * limitation useActiveBranch.tsx already has for a nested blank node's own sub-edits.
 */
export function useActiveChoiceBranch(
  choiceElement: ChoiceElement,
  branchShapes: Term[],
): Term | undefined {
  const revision = useReactiveRead(
    choiceElement.dataGraph,
    `active-choice-branch@${choiceElement.focusNode.value}`,
    () =>
      choiceElement.dataGraph.getQuads(choiceElement.focusNode).length +
      choiceElement.dataGraph.getQuads(null, null, choiceElement.focusNode).length,
  );

  const { data } = useQuery({
    queryKey: [
      "active-choice-branch",
      choiceElement.connective,
      choiceElement.shape.value,
      branchShapes.map((shape) => shape.value),
      choiceElement.focusNode.value,
      revision,
    ],
    queryFn: async () =>
      branchShapes.length > 0
        ? ((await detectActiveChoiceBranch(choiceElement, branchShapes)) ?? null)
        : null,
    ...noRefetch,
  });

  return data ?? undefined;
}
