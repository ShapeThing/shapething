import { makeReactive, type ResolveLink, untracked } from "@shapething/shacl-renderer";
import { RdfStore } from "rdf-stores";
import { type RefObject, useCallback, useEffect, useMemo } from "react";
import { summaryQuads } from "../../data/graphs.ts";
import type { PersonSummary } from "../../data/person.ts";
import { useAbstract, useEntity } from "../../data/queries.ts";
import { factory, inf, schema } from "../../rdf/namespaces.ts";
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
 * An opened person also shows the introduction of their Wikipedia article: who they are, to decide
 * whether to follow them. It arrives later (the article is found with the entity, the same query as
 * the modal's, then the introduction is fetched), so the data graph is a live store: the
 * introduction is added to it when it arrives and removed when the person is closed, and the
 * renderer shows it in place without loading the portrait again. What they made, their ideas and
 * their interests are in the modal.
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
  const entity = useEntity(isActive ? person.id : undefined);
  const article = isActive ? entity.data?.article : undefined;
  const abstractQuery = useAbstract(article);
  const abstract = article ? abstractQuery.data : undefined;
  // Waiting for the entity, or for the introduction of its article. Without an article (or when
  // either fails) the opened person has none, and nothing is waited for.
  const isLoading =
    isActive && (entity.isPending || (article !== undefined && abstractQuery.isPending));

  const dataGraph = useMemo(() => {
    const store = RdfStore.createDefault();
    for (const quad of summaryQuads(person)) store.addQuad(quad);
    return makeReactive(store);
  }, [person]);

  // Data arriving, not an edit: untracked, so it never becomes an undo step.
  useEffect(() => {
    if (!abstract) return;
    // With the introduction, the text of the link to the rest of it in the modal (inf:ColumnShape).
    const quads = [
      factory.quad(person.iri, schema("abstract"), abstract),
      factory.quad(person.iri, inf("viewMore"), factory.literal("View more", "en")),
    ];
    untracked(dataGraph, () => {
      quads.forEach((quad) => dataGraph.addQuad(quad));
    });
    return () =>
      untracked(dataGraph, () => {
        quads.forEach((quad) => dataGraph.removeQuad(quad));
      });
  }, [dataGraph, person, abstract]);

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
      // Wikidata knows no one this person influenced: opening them shows who they are, but no
      // next column of people (style.scss mutes the row).
      data-influence={person.influence ? undefined : "none"}
    >
      {isInView && (
        <Display
          className="person__display"
          shape={ColumnShape}
          focusNode={person.iri}
          dataGraph={dataGraph}
          resolveLink={resolveLink}
          // No spinner per person: the column shows one while its people load. `false`, since
          // `null` means the renderer's own spinner.
          settleIndicator={false}
        />
      )}
      {isLoading && <Spinner className="person__abstract-spinner" />}
    </article>
  );
}
