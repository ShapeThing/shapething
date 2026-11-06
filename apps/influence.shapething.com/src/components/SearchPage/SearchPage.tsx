import { useId, useMemo, useState } from "react";
import { MINIMUM_SEARCH_LENGTH, useSearch } from "../../data/queries.ts";
import { createInfluenceScale, InfluenceScaleContext } from "../../influence/influenceScale.ts";
import { useDebouncedValue } from "../../useDebouncedValue.ts";
import Bookmarks from "../Bookmarks/Bookmarks.tsx";
import Spinner from "../Spinner/Spinner.tsx";
import Teaser from "../Teaser/Teaser.tsx";
import "./style.scss";

export default function SearchPage() {
  const inputId = useId();
  const [text, setText] = useState("");
  const searchText = useDebouncedValue(text, 400).trim();
  const isSearchable = searchText.length >= MINIMUM_SEARCH_LENGTH;
  const search = useSearch(searchText);
  const results = isSearchable ? search.data : undefined;

  // The relative influence of a result is measured against the other results.
  const scale = useMemo(
    () => createInfluenceScale(results?.map((person) => person.influence) ?? []),
    [results],
  );

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
        <div className="search-form__field">
          <img className="search-form__icon" src="/zoom.svg" alt="" />
          <input
            id={inputId}
            className="search-form__input"
            type="search"
            autoComplete="off"
            // Searching is what this page is for.
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {isSearchable && search.isFetching && (
            <Spinner label="Searching" className="search-form__spinner" />
          )}
        </div>
      </form>

      {search.isError && isSearchable && (
        <p className="search-page__message">
          Unfortunately the data source is unavailable. Please come back later.
        </p>
      )}

      {results && results.length === 0 && (
        <p className="search-page__message">No people found for “{searchText}”.</p>
      )}

      {results && results.length > 0 && (
        <InfluenceScaleContext.Provider value={scale}>
          <ul className="search-page__results" aria-label="People found">
            {results.map((person) => (
              <li key={person.id}>
                <Teaser person={person} />
              </li>
            ))}
          </ul>
        </InfluenceScaleContext.Provider>
      )}

      {!results && (
        <p className="search-page__hint">
          You can try <a href="/Q6512">Søren Kierkegaard</a> or <a href="/Q859">Plato</a>
        </p>
      )}

      <Bookmarks />
    </main>
  );
}
