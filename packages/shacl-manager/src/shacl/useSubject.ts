import { useMatch } from "react-router";
import type { SubjectKind } from "../app/paths.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { Resource } from "../data-model/rdf.ts";
import { segmentToTerm } from "../data-model/segments.ts";

export type Subject = { kind: SubjectKind; term: Resource };

const kinds: readonly string[] = ["shape", "class", "group"] satisfies SubjectKind[];

// Matched against the whole URL, not the route's params, so the layout's aside can use it too.
export function useSubject(): Subject | undefined {
  const params = useMatch("/shapes/:origin/:kind/:segment/*")?.params;
  const dataModel = useDataModel();
  if (!params?.kind || !kinds.includes(params.kind) || !params.segment) return undefined;
  const term = segmentToTerm(params.segment, dataModel);
  return term ? { kind: params.kind as SubjectKind, term } : undefined;
}
