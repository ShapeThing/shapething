import type { ResolveLink } from "@shapething/shacl-renderer";
import { useCallback, useMemo } from "react";
import { summaryQuads } from "../../data/graphs.ts";
import type { PersonSummary } from "../../data/person.ts";
import { TeaserShape } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import "./style.scss";

/**
 * A search result, rendered with inf:TeaserShape. The name is a link (st:href) that starts with
 * this person, and covers the whole result (style.scss); the portrait opens in the lightbox.
 */
export default function Teaser({ person }: { person: PersonSummary }) {
  const quads = useMemo(() => summaryQuads(person), [person]);
  const label = useCallback<ResolveLink>(
    (href) =>
      href === `/${person.id}` ? { "aria-label": `Start with ${person.name}` } : undefined,
    [person],
  );

  return (
    <Display
      className="teaser"
      shape={TeaserShape}
      focusNode={person.iri}
      dataGraph={quads}
      resolveLink={label}
    />
  );
}
