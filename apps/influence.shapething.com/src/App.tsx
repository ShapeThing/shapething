import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import ColumnsPage from "./components/ColumnsPage/ColumnsPage.tsx";
import SearchPage from "./components/SearchPage/SearchPage.tsx";
import Spinner from "./components/Spinner/Spinner.tsx";
import { isEntityId } from "./data/entities.ts";
import { resolveTitleIds } from "./data/wikipedia.ts";
import { navigate, pathForIds, useAppLocation } from "./routing.ts";
import { useLinkHandling } from "./useLinkHandling.ts";

export default function App() {
  useLinkHandling();
  const { ids } = useAppLocation();

  // Older URLs and bookmarks have Wikipedia titles instead of Wikidata identifiers.
  const hasTitles = ids.some((id) => !isEntityId(id));
  const resolved = useQuery({
    queryKey: ["resolveTitles", ids],
    queryFn: () => resolveTitleIds(ids),
    enabled: hasTitles,
  });

  useEffect(() => {
    if (hasTitles && resolved.data) {
      navigate(`${pathForIds(resolved.data)}${window.location.hash}`, { replace: true });
    }
  }, [hasTitles, resolved.data]);

  if (hasTitles) {
    return (
      <main className="app-message">
        {resolved.isError ? (
          <p>Unfortunately the data source is unavailable. Please come back later.</p>
        ) : (
          <Spinner label="Opening the link" />
        )}
      </main>
    );
  }

  return ids.length ? <ColumnsPage key={ids[0]} ids={ids} /> : <SearchPage />;
}
