import { useMemo } from "react";
import { summaryQuads } from "../../data/graphs.ts";
import type { PersonSummary } from "../../data/person.ts";
import { TeaserShape } from "../../shapes/shapes.ts";
import Display from "../Display/Display.tsx";
import "./style.scss";

/** A search result, rendered with inf:TeaserShape: a link that starts with this person. */
export default function Teaser({ person }: { person: PersonSummary }) {
  const quads = useMemo(() => summaryQuads(person), [person]);

  return (
    <a className="teaser" href={`/${person.id}`} aria-label={`Start with ${person.name}`}>
      <Display
        className="teaser__display"
        shape={TeaserShape}
        focusNode={person.iri}
        dataGraph={quads}
      />
    </a>
  );
}
