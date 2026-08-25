import { Localized } from "@fluent/react";
import type { Quad_Subject } from "@rdfjs/types";
import { useEffect, useRef } from "react";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

// Moves `from`'s whole subgraph onto `to`: every quad hanging off it as subject (its own raw
// properties, rendered as the fields below) and every quad pointing at it as object (the parent
// property's own link, which setTerm()'s replaceObject() also updates, but only for that one
// property - this covers any other reference too). Without this, giving the node an identifier
// would leave its already-filled-in fields dangling off the blank node nothing points at any more.
function retarget(dataGraph: RdfStore, from: Quad_Subject, to: Quad_Subject): void {
  for (const quad of dataGraph.getQuads(from)) {
    dataGraph.removeQuad(quad);
    dataGraph.addQuad(factory.quad(to, quad.predicate, quad.object, quad.graph));
  }
  for (const quad of dataGraph.getQuads(null, null, from)) {
    dataGraph.removeQuad(quad);
    dataGraph.addQuad(factory.quad(quad.subject, quad.predicate, to, quad.graph));
  }
}

export default function BlankNodeEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  // Every identity change - the initial "assign an identifier" click as well as any later edit of
  // that identifier's IRI - has to carry the node's own fields along with it, so this always goes
  // through retarget() rather than a plain setTerm().
  const changeIdentity = (next: Quad_Subject) => {
    retarget(shape.dataGraph, term as Quad_Subject, next);
    setTerm(next);
  };

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    changeIdentity(factory.namedNode(value)),
  );

  // Assigning an identifier swaps the button out for the identifier input in the same render pass,
  // so focus can't be set inline in the click handler - this flag carries the intent across that
  // render until the input actually exists to receive it.
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const focusIdentifierAfterAssign = useRef(false);

  useEffect(() => {
    if (focusIdentifierAfterAssign.current && term.termType === "NamedNode") {
      focusIdentifierAfterAssign.current = false;
      identifierInputRef.current?.focus();
    }
  }, [term]);

  return (
    <div className="st-blank-node-editor">
      {term.termType === "BlankNode" ? (
        <Localized id="blank-node-editor-assign-identifier">
          <button
            type="button"
            className="st-button st-blank-node-editor__assign"
            onClick={() => {
              focusIdentifierAfterAssign.current = true;
              changeIdentity(factory.namedNode(""));
            }}
          >
            Change nested node to node with identifier
          </button>
        </Localized>
      ) : (
        <Localized id="blank-node-editor-identifier-placeholder" attrs={{ placeholder: true }}>
          <input
            ref={identifierInputRef}
            type="text"
            className="st-input st-blank-node-editor__identifier"
            placeholder="Identifier (IRI)…"
            value={localValue}
            onChange={onChange}
            onBlur={onBlur}
            aria-labelledby={labelledBy}
          />
        </Localized>
      )}
    </div>
  );
}
