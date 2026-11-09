import type { NamedNode } from "@rdfjs/types";
import { type ResolveLink, untracked } from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { clsx } from "../../clsx.ts";
import { entityIri, isEntityId } from "../../data/entities.ts";
import { useAbstract, useEntity } from "../../data/queries.ts";
import { factory, inf, schema } from "../../rdf/namespaces.ts";
import { SORT_LABELS, type SortOrder } from "../../sorting.ts";
import Display from "../Display/Display.tsx";
import ErrorMessage from "../ErrorMessage/ErrorMessage.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import "./style.scss";

type Props = {
  title: string;
  /** What the column renders: the subject of a column shape (src/shapes/ColumnShapes.ttl), or the
   * person the chain starts with, rendered with inf:TeaserShape. */
  subject: NamedNode;
  shape: NamedNode;
  /** The data of every column of the page, one live store (see ColumnsPage). */
  dataGraph: RdfStore;
  isLoading: boolean;
  isError: boolean;
  /** The query answered, without anyone in it. */
  isEmpty: boolean;
  /** Asks Wikidata again after an error. */
  onRetry: () => void;
  /** How the column is sorted (kept in the URL, see sorting.ts). Without a change handler the column
   * can not be sorted. */
  sortOrder?: SortOrder;
  onSortChange?: (order: SortOrder) => void;
  /** The opened one of this column. */
  activeId: string | undefined;
  /** The column of the person the chain starts with. */
  isSelected?: boolean;
  /** Where clicking someone in the column goes: opening them, closing them, or starting over. */
  hrefFor: (id: string) => string;
  /** The opened one of this column is being closed: its cross spins. */
  isClosing?: boolean;
  /** A person before this column is being closed: the column folds away. */
  isRemoving?: boolean;
  /** Called when the column has folded away. */
  onRemoved?: () => void;
  /** Closing the opened one, instead of following the link right away. */
  onClose?: (href: string) => void;
};

/**
 * A column: one renderer, whose shape lists the people (src/shapes/ColumnShapes.ttl, each with
 * inf:TeaserShape) and orders them. The column itself only has its header and the state of the
 * page. The links of the shape (st:href inf:openHref, "/Q…") are pointed at the place in the chain
 * of this column (resolveLink): the opened one is marked as the current one (aria-current) and
 * closes it, and the stylesheet shows only that one while it is open.
 *
 * The opened one also shows the introduction of their Wikipedia article: who they are, to decide
 * whether to follow them. It arrives later (the article is found with the entity, the same query
 * as the modal's, then the introduction is fetched): it is added to the live data graph, and the
 * renderer shows it in place.
 */
export default function Column({
  title,
  subject,
  shape,
  dataGraph,
  isLoading,
  isError,
  isEmpty,
  onRetry,
  sortOrder = "influence",
  onSortChange,
  activeId,
  isSelected = false,
  hrefFor,
  isClosing = false,
  isRemoving = false,
  onRemoved,
  onClose,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const isActive = activeId !== undefined;

  const entity = useEntity(activeId);
  const article = entity.data?.find(
    (quad) => quad.predicate.equals(schema("about")) && quad.subject.termType === "NamedNode",
  )?.subject as NamedNode | undefined;
  const abstractQuery = useAbstract(article);
  const abstract = article ? abstractQuery.data : undefined;
  // Waiting for the entity, or for the introduction of its article. Without an article (or when
  // either fails) there is none, and nothing is waited for.
  const isAbstractLoading =
    isActive && (entity.isPending || (article !== undefined && abstractQuery.isPending));

  // Data arriving, not an edit: untracked, so it never becomes an undo step. With the introduction,
  // the text of the link to the rest of it in the modal (inf:TeaserShape).
  useEffect(() => {
    if (!activeId || !abstract) return;
    const iri = entityIri(activeId);
    const quads = [
      factory.quad(iri, schema("abstract"), abstract),
      factory.quad(iri, inf("viewMore"), factory.literal("View more", "en")),
    ];
    untracked(dataGraph, () => quads.forEach((quad) => dataGraph.addQuad(quad)));
    return () => untracked(dataGraph, () => quads.forEach((quad) => dataGraph.removeQuad(quad)));
  }, [dataGraph, activeId, abstract]);

  // The opened one is the only one shown (style.scss): at the top of the column.
  useLayoutEffect(() => {
    innerRef.current?.scrollTo({ top: 0 });
  }, [activeId]);

  // inf:openHref is "/Q…", starting a chain with them: in a column it opens or closes them instead,
  // or (the opened one being closed) first lets the columns after it fold away.
  const resolveLink = useCallback<ResolveLink>(
    (link) => {
      const id = link.slice(1);
      if (!link.startsWith("/") || !isEntityId(id)) return undefined;
      const href = hrefFor(id);
      const isOpened = id === activeId;
      return {
        href,
        title: isOpened ? "Close" : undefined,
        "aria-current": isOpened ? "true" : undefined,
        "aria-busy": isOpened && isClosing ? "true" : undefined,
        onClick: (event) => {
          // A plain click only, a modifier key still opens the link in a new tab or window.
          if (
            !isOpened ||
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
    [hrefFor, activeId, isClosing, onClose],
  );

  return (
    <section
      className={clsx(
        "column",
        isSelected && "column--selected",
        isActive && "column--active",
        isRemoving && "column--removing",
      )}
      aria-label={title}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === "remove-column") {
          onRemoved?.();
        }
      }}
    >
      <header className="column__header">
        <h2 className="column__title">{title}</h2>
        {onSortChange && !isActive && !isEmpty && (
          <select
            className="column__sort"
            aria-label={`Sort: ${title}`}
            value={sortOrder}
            onChange={(event) => onSortChange(event.target.value as SortOrder)}
          >
            {Object.entries(SORT_LABELS).map(([order, label]) => (
              <option key={order} value={order}>
                {label}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="column__inner" ref={innerRef}>
        {isLoading && <Spinner className="column__spinner" />}
        {isError && <ErrorMessage className="column__message" onRetry={onRetry} />}
        {!isLoading && !isError && isEmpty && <p className="column__message">Nothing found.</p>}
        {!isLoading && !isError && !isEmpty && (
          <Display
            className="column__display"
            shape={shape}
            focusNode={subject}
            dataGraph={dataGraph}
            resolveLink={resolveLink}
            // The column shows a spinner while its people load. `false`, since `null` means the
            // renderer's own spinner.
            settleIndicator={false}
          />
        )}
        {isAbstractLoading && <Spinner className="column__abstract-spinner" />}
      </div>
    </section>
  );
}
