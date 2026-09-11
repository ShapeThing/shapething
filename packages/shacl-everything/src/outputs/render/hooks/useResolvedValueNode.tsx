import type { NamedNode, Term } from "@rdfjs/types";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { valueNodeClassification, valueNodeDepiction, valueNodeLabel } from "@/resolution/label.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export type ResolvedValueNode = {
  label: string;
  classification?: { term: Term; label: string };
  depiction?: NamedNode;
};

/**
 * A value node's label/classification/depiction - same roles as valueNodeLabel/valueNodeClassification/
 * valueNodeDepiction (resolution/label.ts), but also covering a value whose LabelRole/DepictionRole
 * only exist on a remote endpoint (e.g. a federated `sh:in [ sh:select ... ]` result like a
 * dbpedia country IRI, which has genuinely no local triples of its own to walk). Mirrors
 * AutoCompleteEditor's own "resolve the currently applied value's roles" call (useOptionLookups) -
 * the same federated lookup, just for a read-only viewer instead of an editor's selected-value chip.
 *
 * The local, synchronous resolution (kept live via useReactiveRead, same as BlankNodeViewer's own
 * direct valueNodeLabel call - a plain render-time call here would miss a later edit to the value's
 * label-contributing triples) is what renders on the very first paint. The federated lookup only
 * ever runs for a NamedNode with no local triples at all (`remoteCandidates` below) - a value with
 * real local data resolves it locally and never touches the remote query, so a federated result can
 * only ever fill in a genuine gap, never override a correct local resolution with a worse one (e.g.
 * an arbitrary branch of an sh:alternativePath the remote query's own aggregation happened to pick).
 */
export function useResolvedValueNode(
  shape: PropertyUIElement,
  term: Term,
  languages: BCP47[],
): ResolvedValueNode {
  const { localLabel, localClassification, localDepiction } = useReactiveRead(
    shape.dataGraph,
    `resolved-value-node@${term.value}@${languages.join(",")}`,
    () => ({
      localLabel: valueNodeLabel({ term, propertyShape: shape, languages }),
      localClassification: valueNodeClassification({ term, propertyShape: shape, languages }),
      localDepiction: valueNodeDepiction({ term, propertyShape: shape }),
    }),
  );

  const hasLocalTriples =
    term.termType === "NamedNode" && shape.dataGraph.getQuads(term, null, null).length > 0;
  const remoteCandidates = term.termType === "NamedNode" && !hasLocalTriples ? [term] : [];
  const [resolved] = useOptionLookups(shape, remoteCandidates);

  return {
    label: resolved?.label ?? localLabel.value,
    classification: resolved?.classification ?? localClassification,
    depiction: resolved?.depiction ?? localDepiction,
  };
}
