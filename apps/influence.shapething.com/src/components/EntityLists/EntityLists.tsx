import { makeReactive, untracked } from "@shapething/shacl-renderer";
import { RdfStore } from "rdf-stores";
import { useEffect, useMemo } from "react";
import { itemListQuads, lifeEventQuads, summaryQuads } from "../../data/graphs.ts";
import type { ItemKind, ItemLists, PersonSummary } from "../../data/person.ts";
import { useCovers } from "../../data/queries.ts";
import { factory, wdt } from "../../rdf/namespaces.ts";
import { PersonListShapes } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import Thinking from "../Thinking/Thinking.tsx";
import "./style.scss";

/**
 * A tab of a person's modal beside "About": what they made (works, albums, artworks) on a timeline
 * between their birth and death, or their ideas or interests as cards. A renderer of its own, with
 * the shape of the list (shapes/PersonListShapes.ttl). The lists (queries/itemLists.rq) are fetched
 * by the modal.
 *
 * A book or an album gets its cover once that is found (useCovers: Open Library, the Cover Art
 * Archive). The data graph is a live store, so a cover shows up in its card without starting
 * the renderer again.
 */
export default function EntityLists({
  person,
  lists,
  kind,
}: {
  person: PersonSummary;
  lists: ItemLists;
  kind: ItemKind;
}) {
  const dataGraph = useMemo(() => {
    const store = RdfStore.createDefault();
    for (const quad of [
      ...summaryQuads(person),
      ...lifeEventQuads(person),
      ...itemListQuads(person.iri, lists),
    ]) {
      store.addQuad(quad);
    }
    return makeReactive(store);
  }, [person, lists]);

  const covers = useCovers(lists, kind, person.label?.value);

  // Data arriving, not an edit: untracked, so it never becomes an undo step. A cover takes the
  // place of the item's image on Wikidata, which comes back when the cover goes.
  useEffect(() => {
    const replaced = [...covers.keys()].flatMap((work) =>
      dataGraph.getQuads(factory.namedNode(work), wdt("P18")),
    );
    const added = [...covers].map(([work, cover]) =>
      factory.quad(factory.namedNode(work), wdt("P18"), cover),
    );
    untracked(dataGraph, () => {
      replaced.forEach((quad) => dataGraph.removeQuad(quad));
      added.forEach((quad) => dataGraph.addQuad(quad));
    });
    return () =>
      untracked(dataGraph, () => {
        added.forEach((quad) => dataGraph.removeQuad(quad));
        replaced.forEach((quad) => dataGraph.addQuad(quad));
      });
  }, [dataGraph, covers]);

  return (
    <Display
      key={kind}
      className="entity-lists"
      shape={PersonListShapes[kind]}
      focusNode={person.iri}
      dataGraph={dataGraph}
      labelLayout="block"
      settleIndicator={<Thinking />}
    />
  );
}
