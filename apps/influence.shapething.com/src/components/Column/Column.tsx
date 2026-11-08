import { useLayoutEffect, useRef, useState } from "react";
import { clsx } from "../../clsx.ts";
import type { PersonSummary } from "../../data/person.ts";
import ErrorMessage from "../ErrorMessage/ErrorMessage.tsx";
import PersonRow from "../PersonRow/PersonRow.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import { SORT_LABELS, type SortOrder, sortPeople } from "../../sorting.ts";
import "./style.scss";

type Props = {
  title: string;
  people: readonly PersonSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Asks Wikidata again after an error. */
  onRetry: () => void;
  /** How the people are sorted (kept in the URL, see sorting.ts). Without a change handler the
   * column can not be sorted. */
  sortOrder?: SortOrder;
  onSortChange?: (order: SortOrder) => void;
  /** The opened person of this column. */
  activeId: string | undefined;
  /** The column of the person the chain starts with. */
  isSelected?: boolean;
  hrefFor: (person: PersonSummary) => string;
  linkLabelFor: (person: PersonSummary) => string;
  /** The opened person of this column is being closed: its cross spins. */
  isClosing?: boolean;
  /** A person before this column is being closed: the column folds away. */
  isRemoving?: boolean;
  /** Called when the column has folded away. */
  onRemoved?: () => void;
  /** Closing the opened person, instead of following the link right away. */
  onClose?: (href: string) => void;
};

/**
 * A column of people. While one of them is opened, the column shows only that person, scrolled to
 * the top, with the introduction of their Wikipedia article below.
 */
export default function Column({
  title,
  people = [],
  isLoading,
  isError,
  onRetry,
  sortOrder = "influence",
  onSortChange,
  activeId,
  isSelected = false,
  hrefFor,
  linkLabelFor,
  isClosing = false,
  isRemoving = false,
  onRemoved,
  onClose,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filter, setFilter] = useState("");
  const previousActiveId = useRef(activeId);

  const isActive = activeId !== undefined && people.some((person) => person.id === activeId);
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const sortedPeople = isActive ? people : sortPeople(people, sortOrder);
  const shownPeople =
    normalizedFilter && !isActive
      ? sortedPeople.filter((person) => person.name.toLocaleLowerCase().includes(normalizedFilter))
      : sortedPeople;

  // Scrolls the opened person to the top of the column: smoothly when someone is opened, right away
  // when the column comes with an opened person (the people arrive after the column is made).
  useLayoutEffect(() => {
    const isNewlyOpened = previousActiveId.current !== activeId;
    previousActiveId.current = activeId;
    const inner = innerRef.current;
    const row = activeId
      ? inner?.querySelector<HTMLElement>(`.person[data-id="${activeId}"]`)
      : null;
    if (!inner || !row) return;
    inner.scrollTo({
      top: row.offsetTop - 20,
      behavior: isNewlyOpened ? "smooth" : "instant",
    });
  }, [activeId, people.length]);

  const stopFiltering = () => {
    setIsFiltering(false);
    setFilter("");
  };

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
      <header className={clsx("column__header", isFiltering && "column__header--filtering")}>
        <h2 className="column__title">{title}</h2>
        {!isActive && people.length > 1 && (
          <>
            {onSortChange && (
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
            <input
              ref={filterRef}
              className="column__filter"
              type="search"
              placeholder="Filter"
              aria-label={`Filter: ${title}`}
              value={filter}
              tabIndex={isFiltering ? 0 : -1}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") stopFiltering();
              }}
              onBlur={() => {
                if (!filter) setIsFiltering(false);
              }}
            />
            {isFiltering ? (
              <button type="button" className="column__filter-close" onClick={stopFiltering}>
                <span className="visually-hidden">Stop filtering</span>
              </button>
            ) : (
              <button
                type="button"
                className="column__filter-open"
                onClick={() => {
                  setIsFiltering(true);
                  filterRef.current?.focus();
                }}
              >
                <span className="visually-hidden">Filter</span>
              </button>
            )}
          </>
        )}
      </header>

      <div className="column__inner" ref={innerRef}>
        {isLoading && <Spinner className="column__spinner" />}
        {isError && <ErrorMessage className="column__message" onRetry={onRetry} />}
        {!isLoading && !isError && people.length === 0 && (
          <p className="column__message">Nothing found.</p>
        )}
        {normalizedFilter && !isActive && people.length > 0 && shownPeople.length === 0 && (
          <p className="column__message">No one matches “{filter.trim()}”.</p>
        )}

        {shownPeople.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            isActive={person.id === activeId}
            isClosing={isClosing && person.id === activeId}
            onClose={person.id === activeId ? onClose : undefined}
            href={hrefFor(person)}
            linkLabel={linkLabelFor(person)}
            scrollRoot={innerRef}
          />
        ))}

        {/* Room to scroll the opened person to the top, also when it is the last one. */}
        <div className="column__scroll-room" />
      </div>
    </section>
  );
}
