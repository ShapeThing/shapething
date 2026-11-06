import { useLayoutEffect, useRef, useState } from "react";
import { clsx } from "../../clsx.ts";
import type { PersonSummary } from "../../data/person.ts";
import PersonRow from "../PersonRow/PersonRow.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import "./style.scss";

type Props = {
  title: string;
  people: readonly PersonSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
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
 * the top, with their works, interests and ideas below.
 */
export default function Column({
  title,
  people = [],
  isLoading,
  isError,
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
  const shownPeople =
    normalizedFilter && !isActive
      ? people.filter((person) => person.name.toLocaleLowerCase().includes(normalizedFilter))
      : people;

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
        {isError && (
          <p className="column__message">
            Unfortunately the data source is unavailable. Please come back later.
          </p>
        )}
        {!isLoading && !isError && people.length === 0 && (
          <p className="column__message">No one known.</p>
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
