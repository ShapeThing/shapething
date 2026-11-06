import { makeReactive, type ResolveLink, untracked } from "@shapething/shacl-renderer";
import { RdfStore } from "rdf-stores";
import { type RefObject, useCallback, useEffect, useMemo } from "react";
import { itemListQuads, summaryQuads } from "../../data/graphs.ts";
import type { PersonSummary } from "../../data/person.ts";
import { useItemLists } from "../../data/queries.ts";
import { ColumnShape } from "../../shapes/shapes.ts";
import { useInView } from "../../useInView.ts";
import Display from "../Display/Display.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import "./style.scss";

type Props = {
  person: PersonSummary;
  /** Opened: the next column shows who this person influenced. */
  isActive: boolean;
  /** Where clicking the person goes: opening it, closing it, or starting over with it. */
  href: string;
  linkLabel: string;
  /** Being closed: the cross spins. */
  isClosing?: boolean;
  /** Closing this opened person, instead of following the link right away. */
  onClose?: (href: string) => void;
  scrollRoot: RefObject<HTMLElement | null>;
};

/**
 * One person in a column, rendered with inf:ColumnShape. Its st:href links make it interactive: the
 * portrait opens the modal (inf:aboutHref), the name opens or closes the person (inf:openHref, here
 * pointed at the path of this column, see resolveLink) and covers the rest of the row (style.scss).
 * An opened person also shows their works, interests and ideas. They arrive later, so the data graph
 * is a live store: the lists are added to it when they arrive and removed when the person is
 * closed, and the renderer shows them in place without loading the portrait again.
 */
export default function PersonRow({
  person,
  isActive,
  href,
  linkLabel,
  isClosing = false,
  onClose,
  scrollRoot,
}: Props) {
  const itemLists = useItemLists(person.id, isActive);
  const lists = isActive ? itemLists.data : undefined;

  const dataGraph = useMemo(() => {
    const store = RdfStore.createDefault();
    for (const quad of summaryQuads(person)) store.addQuad(quad);
    return makeReactive(store);
  }, [person]);

  // Data arriving, not an edit: untracked, so it never becomes an undo step.
  useEffect(() => {
    if (!lists) return;
    const quads = itemListQuads(person.iri, lists);
    untracked(dataGraph, () => quads.forEach((quad) => dataGraph.addQuad(quad)));
    return () => untracked(dataGraph, () => quads.forEach((quad) => dataGraph.removeQuad(quad)));
  }, [dataGraph, person, lists]);

  const [ref, isInView] = useInView<HTMLElement>(scrollRoot, isActive);

  // The data links the name to starting a chain with the person: in a column it opens or closes
  // them instead, or (the opened person being closed) first lets the columns after it fold away.
  const resolveLink = useCallback<ResolveLink>(
    (link) => {
      if (link === `#${person.id}`) {
        return { title: `About ${person.name}`, "aria-label": `About ${person.name}` };
      }
      if (link !== `/${person.id}`) return undefined;
      return {
        href,
        "aria-label": linkLabel,
        onClick: (event) => {
          // A plain click only, a modifier key still opens the link in a new tab or window.
          if (
            !onClose ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onClose(href);
        },
      };
    },
    [person, href, linkLabel, onClose],
  );

  return (
    <article
      ref={ref}
      className="person"
      data-id={person.id}
      data-active={isActive || undefined}
      data-closing={isClosing || undefined}
    >
      {isInView && (
        <Display
          className="person__display"
          shape={ColumnShape}
          focusNode={person.iri}
          dataGraph={dataGraph}
          resolveLink={resolveLink}
        />
      )}
      {isActive && itemLists.isPending && <Spinner className="person__lists-spinner" />}
    </article>
  );
}
