import type { Quad, Term } from "@rdfjs/types";
import { rdf } from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { isDeactivated } from "../data-model/editGraphs.ts";
import { termKey, type Resource } from "../data-model/rdf.ts";
import { DeactivateButton } from "./edit/DeactivateButton.tsx";
import { DeleteButton } from "./edit/DeleteButton.tsx";
import { EditButton } from "./edit/EditButton.tsx";
import { PreviewButton } from "../owl/PreviewButton.tsx";
import { useOrigin } from "./paths.ts";
import type { ShapeSource } from "./rendererProps.ts";
import { termTitle, useBestByLanguage, useTermLabel } from "./termLabel.ts";

export type HeadingFallbacks = {
  // The chip of a node without an rdf:type: a class, or a word such as the route's title.
  type?: Resource | string;
  // The label of a node without any, e.g. a SPARQL constraint's sh:message.
  label?: (
    term: Resource,
    store: RdfStore,
    bestByLanguage: (values: Term[]) => Term | undefined,
  ) => string | undefined;
};

// What the heading offers for its node, each where it applies: editing a managed node through a
// shape (its dialog's route is `at`/edit, relative to the heading's route), deleting a managed
// node, and disabling or enabling an imported shape, constraint or rule.
export type HeadingActions = {
  edit?: { shapes: ShapeSource; at?: string; startingQuads?: Quad[] };
  delete?: boolean;
  deactivate?: boolean;
  // An example instance of the class, generated from the shapes that apply to it.
  preview?: boolean;
};

// A node's heading: the classes it is an instance of as chips before its label, its IRI below.
// A blank node has no IRI to show. A shape, constraint or rule is struck through when deactivated.
export function SubjectHeading({
  term,
  fallbacks = {},
  actions = {},
}: {
  term: Resource;
  fallbacks?: HeadingFallbacks;
  actions?: HeadingActions;
}) {
  const dataModel = useDataModel();
  const origin = useOrigin();
  const termLabel = useTermLabel();
  const bestByLanguage = useBestByLanguage();
  const types = new Map<string, Resource | string>();
  for (const { object } of dataModel.store.getQuads(term, rdf("type"))) {
    if (object.termType === "NamedNode" || object.termType === "BlankNode") {
      types.set(termKey(object), object);
    }
  }
  if (types.size === 0 && fallbacks.type) types.set("fallback", fallbacks.type);

  return (
    <header
      className={
        actions.deactivate && isDeactivated(dataModel, term)
          ? "st-heading st-heading--deactivated"
          : "st-heading"
      }
    >
      {types.size > 0 && (
        <ul className="st-heading__types">
          {[...types.entries()].map(([key, type]) =>
            typeof type === "string" ? (
              <li key={key} className="st-chip">
                {type}
              </li>
            ) : (
              <li key={key} className="st-chip" title={termTitle(type, dataModel)}>
                {termLabel(type)}
              </li>
            ),
          )}
        </ul>
      )}
      <h2>{termLabel(term, fallbacks.label?.(term, dataModel.store, bestByLanguage))}</h2>
      <div className="st-heading__actions">
        {origin === "managed" && actions.edit && (
          <EditButton
            term={term}
            at={actions.edit.at}
            startingQuads={actions.edit.startingQuads}
            {...actions.edit.shapes}
          />
        )}
        {origin === "managed" && actions.delete && <DeleteButton term={term} />}
        {origin === "imported" && actions.deactivate && <DeactivateButton term={term} />}
        {actions.preview && <PreviewButton term={term} />}
      </div>
      {term.termType === "NamedNode" && <p className="st-heading__iri">{term.value}</p>}
    </header>
  );
}
