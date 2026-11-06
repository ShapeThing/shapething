import { type RefObject, useMemo } from "react";
import { itemListQuads, summaryQuads } from "../../data/graphs.ts";
import type { PersonSummary } from "../../data/person.ts";
import { useItemLists } from "../../data/queries.ts";
import { ColumnShape } from "../../shapes/shapes.ts";
import { useInView } from "../../useInView.ts";
import Avatar from "../Avatar/Avatar.tsx";
import Display from "../Display/Display.tsx";
import "./style.scss";

/** The portrait is shown at 56px: the 120px Commons thumbnail is sharp on high density screens. */
const PORTRAIT_WIDTH = 120;

type Props = {
  person: PersonSummary;
  /** Opened: the next column shows who this person influenced. */
  isActive: boolean;
  /** Where clicking the person goes: opening it, closing it, or starting over with it. */
  href: string;
  linkLabel: string;
  scrollRoot: RefObject<HTMLElement | null>;
};

/**
 * One person in a column, rendered with inf:ColumnShape. The display itself is read only, the two
 * links on top of it make it interactive: the portrait opens the modal, the rest of the row opens
 * or closes the person. An opened person also shows their works, interests and ideas.
 */
export default function PersonRow({ person, isActive, href, linkLabel, scrollRoot }: Props) {
  const itemLists = useItemLists(person.id, isActive);
  const lists = isActive ? itemLists.data : undefined;

  const quads = useMemo(
    () => [
      ...summaryQuads(person, PORTRAIT_WIDTH),
      ...(lists ? itemListQuads(person.iri, lists) : []),
    ],
    [person, lists],
  );

  const [ref, isInView] = useInView<HTMLElement>(scrollRoot, isActive);

  return (
    <article ref={ref} className="person" data-id={person.id} data-active={isActive || undefined}>
      <span className="person__avatar">
        <Avatar name={person.name} />
      </span>
      {isInView && (
        <Display
          className="person__display"
          shape={ColumnShape}
          focusNode={person.iri}
          quads={quads}
        />
      )}
      <a className="person__link" href={href}>
        <span className="visually-hidden">{linkLabel}</span>
      </a>
      <a className="person__portrait-link" href={`#${person.id}`}>
        <span className="visually-hidden">About {person.name}</span>
      </a>
      <span className="person__action" aria-hidden="true" />
    </article>
  );
}
