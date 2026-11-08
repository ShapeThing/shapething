import { useMemo } from "react";
import { itemListQuads, lifeEventQuads, summaryQuads } from "../../data/graphs.ts";
import type { ItemKind, ItemLists, PersonSummary } from "../../data/person.ts";
import { PersonListShapes } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import Thinking from "../Thinking/Thinking.tsx";
import "./style.scss";

/**
 * A tab of a person's modal beside "About": their works on a timeline between their birth and
 * death, or their ideas or interests as cards. A renderer of its own, with the shape of the list
 * (shapes/PersonListShapes.ttl); the lists are those of the column (queries/itemLists.rq), so a
 * person opened there has them already.
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
  const quads = useMemo(
    () => [...summaryQuads(person), ...lifeEventQuads(person), ...itemListQuads(person.iri, lists)],
    [person, lists],
  );

  return (
    <Display
      key={kind}
      className="entity-lists"
      shape={PersonListShapes[kind]}
      focusNode={person.iri}
      dataGraph={quads}
      labelLayout="block"
      settleIndicator={<Thinking />}
    />
  );
}
