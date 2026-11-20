import type { BlankNode, NamedNode } from "@rdfjs/types";
import { useMatch } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { segmentToTerm } from "../data-model/segments.ts";

export type Subject = { kind: "class" | "shape"; term: NamedNode | BlankNode };

// The class or shape the current shapes page is about, read from class/:class or shape/:shape.
// Matched against the whole URL rather than the route's params, so it also works outside those
// routes (the layout's aside). Undefined when there is none, or the segment names a blank node the
// data no longer has.
export function useSubject(): Subject | undefined {
  const match = useMatch("/shapes/:origin/:kind/:segment/*");
  const dataModel = useDataModel();
  const kind = match?.params.kind;
  const segment = match?.params.segment;
  if ((kind !== "class" && kind !== "shape") || !segment) return undefined;
  const term = segmentToTerm(segment, dataModel);
  return term ? { kind, term } : undefined;
}
