import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import type { CSSProperties } from "react";
import { entityId } from "../../data/entities.ts";
import { inf, shui } from "../../rdf/namespaces.ts";
import { valueOf } from "../../shapes/shapes.ts";
import { formatYear, yearOf } from "../../widgets/YearViewer/year.ts";
import Avatar from "../Avatar/Avatar.tsx";
import Modal from "../Modal/Modal.tsx";
import "./style.scss";

/** Someone born (a band formed) this long ago without a date of death is taken to be alive. */
const LIFETIME = 110;

type Lifespan = {
  from: number;
  /** Undefined when the date of death is not known. */
  to: number | undefined;
  isAlive: boolean;
};

/** From the start to the end of a life (inf:StartRole, inf:EndRole): a band's from when it was
 * formed to when it broke up. */
const lifespanOf = (dataGraph: RdfStore, person: NamedNode, now: number): Lifespan | undefined => {
  const start = valueOf(dataGraph, person, inf("StartRole"));
  const from = start?.termType === "Literal" ? yearOf(start) : undefined;
  if (from === undefined) return undefined;
  const end = valueOf(dataGraph, person, inf("EndRole"));
  const to = end?.termType === "Literal" ? yearOf(end) : undefined;
  const isAlive = to === undefined && now - from < LIFETIME;
  return { from, to: isAlive ? now : to, isAlive };
};

// A portrait (wdt:P18) is a Commons "Special:FilePath" URL to the full original: Commons serves a
// cached thumbnail of 120px wide instead.
const thumbnailOf = (image: string) => {
  const url = new URL(image);
  if (url.hostname !== "commons.wikimedia.org" || url.pathname.toLowerCase().endsWith(".svg")) {
    return image;
  }
  url.protocol = "https:";
  url.search = new URLSearchParams({ width: "120" }).toString();
  return url.href;
};

/**
 * The round years between min and max to draw a line at: about five, a step of 1, 2 or 5 times a
 * power of ten apart.
 */
const ticksBetween = (min: number, max: number): number[] => {
  const rough = (max - min) / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((step) => step >= rough)!;
  const ticks: number[] = [];
  for (let year = Math.ceil(min / step) * step; year <= max; year += step) ticks.push(year);
  return ticks;
};

/**
 * The lifespans of the people in the chain, in the order of the chain, on one time axis. The years
 * are given to the stylesheet as custom properties, which places the bars and the lines at round
 * years (style.scss).
 */
export default function TimelineModal({
  dataGraph,
  people,
  onClose,
}: {
  /** The data of the columns, the people in it (ColumnsPage). */
  dataGraph: RdfStore;
  people: readonly NamedNode[];
  onClose: () => void;
}) {
  const now = new Date().getFullYear();
  const lifespans = people.map((person) => ({
    id: entityId(person) ?? person.value,
    name: valueOf(dataGraph, person, shui("LabelRole"))?.value ?? "…",
    image: valueOf(dataGraph, person, shui("DepictionRole"))?.value,
    lifespan: lifespanOf(dataGraph, person, now),
  }));
  const known = lifespans.flatMap(({ lifespan }) => (lifespan ? [lifespan] : []));
  // An unknown end gets a bar of a usual lifetime, faded out (style.scss).
  const ends = known.map(({ from, to }) => to ?? from + 70);
  const min = Math.min(...known.map(({ from }) => from));
  const max = Math.max(...ends, min + 1);
  const ticks = ticksBetween(min, max);

  return (
    <Modal title="Timeline" onClose={onClose}>
      {known.length === 0 ? (
        <p>The years of the people in this chain are not known.</p>
      ) : (
        <div className="timeline" style={{ "--min": min, "--max": max } as CSSProperties}>
          <ol className="timeline__rows">
            {lifespans.map(({ id, name, image, lifespan }) => (
              <li
                key={id}
                className="timeline__row"
                style={
                  lifespan &&
                  ({
                    "--from": lifespan.from,
                    "--to": lifespan.to ?? lifespan.from + 70,
                  } as CSSProperties)
                }
              >
                <a className="timeline__name" href={`#${id}`}>
                  <span className="timeline__portrait">
                    {image ? (
                      <img src={thumbnailOf(image)} alt="" loading="lazy" />
                    ) : (
                      <Avatar name={name} />
                    )}
                  </span>
                  {name}
                </a>
                {lifespan ? (
                  <span
                    className="timeline__bar"
                    data-open={lifespan.to === undefined || lifespan.isAlive || undefined}
                  >
                    <span className="timeline__years">
                      {formatYear(lifespan.from)} –{" "}
                      {lifespan.isAlive
                        ? ""
                        : lifespan.to === undefined
                          ? "?"
                          : formatYear(lifespan.to)}
                    </span>
                  </span>
                ) : (
                  <span className="timeline__unknown">Years unknown</span>
                )}
              </li>
            ))}
          </ol>
          <div className="timeline__lines" aria-hidden="true">
            {ticks.map((year) => (
              <span key={year} style={{ "--year": year } as CSSProperties} />
            ))}
          </div>
          <div className="timeline__axis" aria-hidden="true">
            {ticks.map((year) => (
              <span key={year} style={{ "--year": year } as CSSProperties}>
                {formatYear(year)}
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
