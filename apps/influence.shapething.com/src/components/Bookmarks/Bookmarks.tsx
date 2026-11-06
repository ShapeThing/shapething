import { removeBookmark, useBookmarks } from "../../bookmarks.ts";
import { isEntityId } from "../../data/entities.ts";
import { useNames } from "../../data/queries.ts";
import { idsFromPath } from "../../routing.ts";
import "./style.scss";

/** The saved chains of people, by the names of the first and the last person. */
export default function Bookmarks() {
  const bookmarks = useBookmarks();
  const chains = bookmarks
    .map((path) => ({ path, ids: idsFromPath(path) }))
    .filter(({ ids }) => ids.length);
  const names = useNames(chains.flatMap(({ ids }) => ids.filter(isEntityId)));

  if (!chains.length) return null;

  // Bookmarks from the previous version of the app can have Wikipedia titles instead of identifiers.
  const nameOf = (id: string) =>
    names.data?.get(id) ?? (isEntityId(id) ? id : id.replace(/_/g, " "));

  return (
    <section className="bookmarks" aria-labelledby="bookmarks-title">
      <h2 className="bookmarks__title" id="bookmarks-title">
        <img src="/bookmarks.svg" alt="" /> Your bookmarks
      </h2>
      <ul className="bookmarks__list">
        {chains.map(({ path, ids }) => {
          const first = nameOf(ids[0]);
          const label =
            ids.length > 1 ? `${first} → ${nameOf(ids[ids.length - 1])} (${ids.length})` : first;
          return (
            <li key={path} className="bookmarks__item">
              <a className="bookmarks__link" href={path}>
                {label}
              </a>
              <button
                type="button"
                className="bookmarks__remove"
                onClick={() => removeBookmark(path)}
              >
                <img src="/delete.svg" alt={`Remove the bookmark ${label}`} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
