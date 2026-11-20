import { useParams } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { Resource } from "../data-model/rdf.ts";
import { segmentToTerm } from "../data-model/segments.ts";

// Undefined when the route has no such parameter, or it names a blank node the data no longer has.
export function useTermParam(name: string): Resource | undefined {
  const segment = useParams()[name];
  const dataModel = useDataModel();
  return segment ? segmentToTerm(segment, dataModel) : undefined;
}
