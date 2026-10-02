import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { freshIri } from "@/helpers/freshIri.ts";
import { sh } from "@/helpers/namespaces.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import { Code, Swap } from "@/helpers/icons.tsx";
import { Localized } from "@fluent/react";

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

export default function BlankNodeEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  // Every identity change - the initial "assign an identifier" click as well as any later edit of
  // that identifier's IRI - has to carry the node's own fields along with it, so this always goes
  // through retarget() rather than a plain setTerm().
  const changeIdentity = (next: Quad_Subject) => {
    transact(shape.dataGraph, () => {
      retarget(shape.dataGraph, term as Quad_Subject, next);
      setTerm(next);
    });
  };

  // No sh:nodeKind at all leaves every kind open; an explicit one has already been merged down to
  // its allowed set by nodeKindIntersection (e.g. sh:BlankNodeOrIRI -> [BlankNode, IRI]) - only
  // offer to assign an identifier when sh:IRI actually survived that intersection, since doing so
  // when the shape pins this value to sh:nodeKind sh:BlankNode alone would just hand the user a
  // button whose only effect is making their own data invalid.
  const nodeKinds = shape.get(sh("nodeKind"));
  const canAssignIdentifier =
    nodeKinds.length === 0 || nodeKinds.some((kind) => kind.equals(sh("IRI")));
  const assignRef = useAutoFocusRef<HTMLButtonElement>(autoFocus && canAssignIdentifier);

  return (
    <div className="st-blank-node-editor">
      <span className="st-blank-node-editor__identifier">
        <Code />
        {term.value}
      </span>

      {canAssignIdentifier ? (
        <button
          ref={assignRef}
          type="button"
          className="st-button st-blank-node-editor__assign"
          onClick={() => changeIdentity(freshIri(shape.shapesGraph))}
        >
          <Swap />
          <Localized id="blank-node-editor-switch-to-iri">Switch to IRI</Localized>
        </button>
      ) : null}
    </div>
  );
}
