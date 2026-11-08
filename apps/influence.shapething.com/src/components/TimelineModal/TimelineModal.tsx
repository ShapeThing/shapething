import type { CSSProperties } from "react";
import type { PersonSummary } from "../../data/person.ts";
import { formatYear, yearOf } from "../../widgets/YearViewer/year.ts";
import Modal from "../Modal/Modal.tsx";
import "./style.scss";

/** Someone born this long ago without a date of death is taken to be alive. */
const LIFETIME = 110;

type Lifespan = {
  person: PersonSummary;
  from: number;
  /** Undefined when the date of death is not known. */
  to: number | undefined;
  isAlive: boolean;
};

const lifespanOf = (person: PersonSummary, now: number): Lifespan | undefined => {
  const from = person.birthDate && yearOf(person.birthDate);
  if (from === undefined) return undefined;
  const to = person.deathDate && yearOf(person.deathDate);
  const isAlive = to === undefined && now - from < LIFETIME;
  return { person, from, to: isAlive ? now : to, isAlive };
};

/**
 * The lifespans of the people in the chain, in the order of the chain, on one time axis. The years
 * are given to the stylesheet as custom properties, which places the bars (style.scss).
 */
export default function TimelineModal({
  people,
  onClose,
}: {
  people: readonly PersonSummary[];
  onClose: () => void;
}) {
  const now = new Date().getFullYear();
  const lifespans = people.map((person) => ({ person, lifespan: lifespanOf(person, now) }));
  const known = lifespans.flatMap(({ lifespan }) => (lifespan ? [lifespan] : []));
  // An unknown end gets a bar of a usual lifetime, faded out (style.scss).
  const ends = known.map(({ from, to }) => to ?? from + 70);
  const min = Math.min(...known.map(({ from }) => from));
  const max = Math.max(...ends, min + 1);

  return (
    <Modal title="Timeline" onClose={onClose}>
      {known.length === 0 ? (
        <p>The years of the people in this chain are not known.</p>
      ) : (
        <div className="timeline" style={{ "--min": min, "--max": max } as CSSProperties}>
          <ol className="timeline__rows">
            {lifespans.map(({ person, lifespan }) => (
              <li
                key={person.id}
                className="timeline__row"
                style={
                  lifespan &&
                  ({
                    "--from": lifespan.from,
                    "--to": lifespan.to ?? lifespan.from + 70,
                  } as CSSProperties)
                }
              >
                <a className="timeline__name" href={`#${person.id}`}>
                  {person.name}
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
          <div className="timeline__axis" aria-hidden="true">
            <span>{formatYear(min)}</span>
            <span>{formatYear(max)}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
