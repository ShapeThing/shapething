import { type FocusEvent, type KeyboardEvent, useId, useRef, useState } from "react";
import { MINIMUM_SEARCH_LENGTH, useSearch } from "../../data/queries.ts";
import { useDebouncedValue } from "../../useDebouncedValue.ts";
import Bookmarks from "../Bookmarks/Bookmarks.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import Teaser from "../Teaser/Teaser.tsx";
import "./style.scss";

/** The links of the results (the names, see Teaser), in the order they are shown. */
const resultLinks = (list: HTMLElement | null) => [
  ...(list?.querySelectorAll<HTMLAnchorElement>(".teaser .name a[href]") ?? []),
];

export default function SearchPage() {
  const inputId = useId();
  const resultsId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [text, setText] = useState("");
  // The dropdown closes with Escape or when the focus leaves the search, and opens again on typing
  // or when the input gets the focus back.
  const [isOpen, setIsOpen] = useState(true);
  const searchText = useDebouncedValue(text, 400).trim();
  const isSearchable = searchText.length >= MINIMUM_SEARCH_LENGTH;
  const search = useSearch(searchText);
  const results = isSearchable ? search.data : undefined;

  const showsError = search.isError && isSearchable;
  const hasDropdown = isOpen && (showsError || results !== undefined);

  // Up and down move through the input and the results, like an autocomplete; Escape closes the
  // dropdown and returns to the input.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && hasDropdown) {
      event.preventDefault();
      setIsOpen(false);
      inputRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const links = resultLinks(listRef.current);
    if (!links.length) return;
    event.preventDefault();
    setIsOpen(true);
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === "ArrowDown" ? current + 1 : current - 1;
    if (next < 0) inputRef.current?.focus();
    else links[Math.min(next, links.length - 1)].focus();
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
  };

  return (
    <main className="search-page">
      <header className="site-header">
        <img className="site-header__logo" src="/logo.svg" alt="" />
        <h1 className="site-header__title">Influence</h1>
      </header>

      <form className="search-form" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="search-form__label" htmlFor={inputId}>
          Search for a philosopher or an influential thinker
        </label>
        <div
          className={`search-form__field${hasDropdown ? " search-form__field--open" : ""}`}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        >
          <img className="search-form__icon" src="/zoom.svg" alt="" />
          <input
            ref={inputRef}
            id={inputId}
            className="search-form__input"
            type="search"
            autoComplete="off"
            aria-controls={resultsId}
            aria-expanded={hasDropdown}
            // Searching is what this page is for.
            autoFocus
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setIsOpen(true);
            }}
            // Coming back to the search opens it again, but not the way back from Escape.
            onFocus={(event) => {
              if (!event.currentTarget.parentElement?.contains(event.relatedTarget))
                setIsOpen(true);
            }}
            onClick={() => setIsOpen(true)}
          />
          {isSearchable && search.isFetching && (
            <Spinner label="Searching" className="search-form__spinner" />
          )}

          <div className="search-dropdown" id={resultsId} hidden={!hasDropdown}>
            {showsError && (
              <p className="search-dropdown__message">
                Unfortunately the data source is unavailable. Please come back later.
              </p>
            )}

            {!showsError && results?.length === 0 && (
              <p className="search-dropdown__message">No people found for “{searchText}”.</p>
            )}

            {!showsError && results && results.length > 0 && (
              <ul className="search-dropdown__results" aria-label="People found" ref={listRef}>
                {results.map((person) => (
                  <li key={person.id}>
                    <Teaser person={person} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </form>

      <p className="search-page__hint">
        You can try <a href="/Q6512">Søren Kierkegaard</a>, <a href="/Q859">Plato</a> or{" "}
        <a href="/Q892">J. R. R. Tolkien</a>
      </p>

      <Bookmarks />
    </main>
  );
}
