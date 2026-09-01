import { useState } from "react";
import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

// Escapes regex metacharacters so the typed text is matched literally (a "contains" search), not
// interpreted as a regular expression - sh:pattern is a plain RDF regular expression per the SHACL
// spec, and a facet's search box is meant to search for text, not author a regex.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function TextSearchFacet({
  setConstraint,
  searchMatchCount,
  labelledBy,
}: FacetWidgetProps) {
  const [search, setSearch] = useState("");

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

          if (raw === "") {
            setConstraint(sh("pattern"), undefined);
            setConstraint(sh("flags"), undefined);
            return;
          }

          setConstraint(sh("pattern"), factory.literal(escapeRegExp(raw), xsd("string")));
          setConstraint(sh("flags"), factory.literal("i", xsd("string")));
        }}
      />
      {searchMatchCount !== undefined && (
        <span className="st-text-search-facet__count"> ({searchMatchCount})</span>
      )}
    </div>
  );
}
