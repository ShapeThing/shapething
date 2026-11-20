import type { NamedNode } from "@rdfjs/types";
import type { ReactNode } from "react";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { Origin, Perspective } from "./paths.ts";
import "./originIntro.css";

const perspectiveText: Record<Perspective, ReactNode> = {
  shapes: (
    <>
      <h3>SHACL shapes</h3>
      <p>
        A SHACL shape describes what data should look like: which properties a resource of a class
        has, how many values each may have, and of which type. Shapes are used to validate data and
        to build the forms and views of the SHACL renderer.
      </p>
    </>
  ),
  knowledge: (
    <>
      <h3>OWL and RDFS knowledge</h3>
      <p>
        An ontology, written in OWL and RDFS, describes what things mean: the classes there are, the
        properties between them, and how they relate through subclasses, domains and ranges. Where a
        shape says what data must look like, the ontology says what it means.
      </p>
    </>
  ),
};

const sidebarText: Record<Perspective, ReactNode> = {
  shapes: (
    <ul>
      <li>
        <strong>Hierarchy</strong>: shapes with an <code>sh:targetClass</code>, nested by the
        subclass hierarchy of the classes they target.
      </li>
      <li>
        <strong>Other shapes</strong>: shapes without a target class, often reused by other shapes
        through <code>sh:node</code>.
      </li>
      <li>
        <strong>Property groups</strong>: the sections a form is divided into. A group gathers
        property shapes from any shape.
      </li>
    </ul>
  ),
  knowledge: (
    <ul>
      <li>
        <strong>Hierarchy</strong>: named classes, nested by <code>rdfs:subClassOf</code>.
      </li>
      <li>
        <strong>Anonymous classes</strong>: class expressions without an IRI, such as restrictions
        and <code>owl:unionOf</code> lists.
      </li>
    </ul>
  ),
};

// The page an origin opens on: what this part of the manager shows.
export function OriginIntro({ perspective, origin }: { perspective: Perspective; origin: Origin }) {
  return (
    <div className="st-origin-intro">
      {perspectiveText[perspective]}
      {origin === "managed" ? <ManagedText /> : <ImportedText />}
      <h3>In the sidebar</h3>
      {sidebarText[perspective]}
      <p>Pick an item in the sidebar to see everything that is said about it.</p>
    </div>
  );
}

function ManagedText() {
  const { dataModelIRI } = useDataModel();
  return (
    <>
      <h3>Managed</h3>
      <p>
        Managed is what this data model declares itself, in its own graph{" "}
        <code>{dataModelIRI.value}</code>. This is the part you work on: it can be edited and added
        to here, and every change is handed to the application to save.
      </p>
    </>
  );
}

function ImportedText() {
  const { importedGraphIRIs, cachedGraphIRIs, unresolvableGraphIRIs } = useDataModel();
  const isCached = (graph: NamedNode) => cachedGraphIRIs.some((cached) => cached.equals(graph));

  return (
    <>
      <h3>Imported</h3>
      <p>
        Imported is what the data model takes from other sources through <code>owl:imports</code>,
        such as published standards and application profiles. It is shown read-only: it changes only
        where it is published. Imports are kept in the browser, so they load fast next time.
      </p>
      {importedGraphIRIs.length > 0 ? (
        <ul>
          {importedGraphIRIs.map((graph) => (
            <li key={graph.value}>
              <code>{graph.value}</code>
              {isCached(graph) && " (from the browser cache)"}
            </li>
          ))}
        </ul>
      ) : (
        <p>This data model imports nothing.</p>
      )}
      {unresolvableGraphIRIs.length > 0 && (
        <>
          <p>These imports could not be loaded:</p>
          <ul>
            {unresolvableGraphIRIs.map((graph) => (
              <li key={graph.value}>
                <code>{graph.value}</code>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
