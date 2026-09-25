import { useEffect, useMemo, useState } from "react";
import type { Term } from "@rdfjs/types";
import { useQuery } from "@tanstack/react-query";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh, xsd } from "@/helpers/namespaces.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { runQuery, substituteSearchParameters } from "@/outputs/render/hooks/query.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { searchQueryFor } from "@/widgets/implementations/shui/editors/AutoCompleteEditor/searchQuery.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

// Mirrors useInstanceSearch's own debounce - a shui:searchQuery round trip is a real (possibly
// remote) query, unlike the plain sh:pattern write below, so it shouldn't fire on every keystroke.
const SEARCH_DEBOUNCE_MS = 200;

// Escapes regex metacharacters so the typed text is matched literally (a "contains" search), not
// interpreted as a regular expression - sh:pattern is a plain RDF regular expression per the SHACL
// spec, and a facet's search box is meant to search for text, not author a regex.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function TextSearchFacet({ shape, setConstraint, labelledBy }: FacetWidgetProps) {
  const [search, setSearch] = useState("");
  // When the property declares shui:searchQuery (spec §10.1), the typed text is handed to that
  // query instead of becoming an sh:pattern - the shape author's own (typically fulltext-indexed,
  // possibly federated) search decides what matches, and its ?value results become an sh:in on
  // this property. Unlike AutoCompleteEditor's own use of the same query, every result type is
  // kept (a searchQuery over a literal-valued property returns literals) and no role resolution
  // is needed - only the matching values themselves matter here, not their labels.
  const searchQuery = useMemo(() => searchQueryFor(shape), [shape]);
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { corsProxyUrl, facetsEndpoint } = useEnvironment();
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!searchQuery) return;
    const timeout = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchQuery, search]);

  const { data: matches } = useQuery({
    queryKey: [
      "text-search-facet",
      shape.propertyShapes.map((s) => s.value),
      searchQuery,
      debounced,
      activeInterfaceLanguage,
      facetsEndpoint,
    ],
    queryFn: async (): Promise<Term[]> =>
      dedupeTerms(
        (
          await runQuery(
            substituteSearchParameters(searchQuery!, debounced, activeInterfaceLanguage),
            shape,
            corsProxyUrl,
            // The search runs over the same data the facets query - the endpoint, when set.
            facetsEndpoint,
          )
        ).map(({ term }) => term),
      ),
    enabled: !!searchQuery && debounced !== "",
    ...noRefetch,
  });

  // Only ever written once the query for the *current* debounced text has resolved, so a slow,
  // stale response can't overwrite a newer one (the query key changes with `debounced`, and
  // `matches` is undefined again until its own result lands). No results at all is written as an
  // explicit empty sh:in (rdf:nil) rather than an empty array - setConstraint treats `[]` as
  // "clear this constraint", which would show every instance instead of none.
  useEffect(() => {
    if (!searchQuery || debounced === "" || matches === undefined) return;
    setConstraint(sh("in"), matches.length > 0 ? matches : rdf("nil"));
    // setConstraint is a fresh closure every render (see FacetPropertyComponent) - only a new
    // result set should trigger a write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, debounced, matches]);

  return (
    <div className="st-text-search-facet">
      <input
        type="search"
        className="st-input"
        value={search}
        aria-labelledby={labelledBy}
        onChange={(event) => {
          const raw = event.target.value;
          setSearch(raw);

          if (searchQuery) {
            // Cleared right away rather than after the debounce, so emptying the box never leaves
            // the previous search's sh:in applied for a moment.
            if (raw.trim() === "") {
              setDebounced("");
              setConstraint(sh("in"), undefined);
            }
            return;
          }

          if (raw === "") {
            setConstraint(sh("pattern"), undefined);
            setConstraint(sh("flags"), undefined);
            return;
          }

          setConstraint(sh("pattern"), factory.literal(escapeRegExp(raw), xsd("string")));
          setConstraint(sh("flags"), factory.literal("i", xsd("string")));
        }}
      />
    </div>
  );
}
