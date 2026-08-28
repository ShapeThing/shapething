import type { NamedNode, Term } from "@rdfjs/types";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import { valueNodeDepiction, valueNodeLabel, valueNodeSubLabel } from "@/resolution/label.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export type ResolvedValueNode = {
  label: string;
  subLabel?: string;
  depiction?: NamedNode;
};

/**
 * A value node's label/subLabel/depiction - same roles as valueNodeLabel/valueNodeSubLabel/
 * valueNodeDepiction (resolution/label.ts), but also covering a value whose LabelRole/DepictionRole
 * only exist on a remote endpoint (e.g. a federated `sh:in [ sh:select ... ]` result like a
 * dbpedia country IRI, which has no local triples of its own to walk). Mirrors AutoCompleteEditor's
 * own "resolve the currently applied value's roles" call (useOptionLookups) - the same federated
 * lookup, just for a read-only viewer instead of an editor's selected-value chip.
 *
 * The local, synchronous resolution is what renders on the very first paint; the federated lookup
 * (async, only attempted for a NamedNode - a blank node/literal has no remote identity to look up)
 * fills in/overrides it once it resolves, same as AutoCompleteOption's own label/depiction do.
 */
export function useResolvedValueNode(
  shape: PropertyUIElement,
  term: Term,
  languages: BCP47[],
): ResolvedValueNode {
  const localLabel = valueNodeLabel({ term, propertyShape: shape, languages });
  const localSubLabel = valueNodeSubLabel({ term, propertyShape: shape, languages });
  const localDepiction = valueNodeDepiction({ term, propertyShape: shape });

  const remoteCandidates = term.termType === "NamedNode" ? [term] : [];
  const [resolved] = useOptionLookups(shape, remoteCandidates);

  return {
    label: resolved?.label ?? localLabel.value,
    subLabel: resolved?.subLabel ?? localSubLabel?.value,
    depiction: resolved?.depiction ?? localDepiction,
  };
}
