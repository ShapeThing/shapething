import { clsx } from "../../clsx.ts";
import Spinner from "../Spinner/Spinner.tsx";
import "./style.scss";

/**
 * What a loading place shows while Wikidata is slow: at first the spinner, and when the wait goes
 * on, a thinker seated on a rock, his chin on his hand, with thoughts rising above him. The
 * thinker is drawn and animated in CSS only (style.scss): when he appears is the animation delay,
 * so nothing is timed here. The room for the thinker is kept from the start, so the spinner
 * changing into him moves nothing.
 */
export default function Thinking({
  label = "Loading",
  caption = "Wikidata is pondering this one…",
  className,
}: {
  label?: string;
  caption?: string;
  className?: string;
}) {
  return (
    <span className={clsx("thinking", className)}>
      <Spinner label={label} className="thinking__spinner" />
      <svg className="thinker" viewBox="0 0 200 190" aria-hidden="true">
        <ellipse className="thinker__shadow" cx="96" cy="180" rx="68" ry="5" />
        <path
          className="thinker__rock"
          d="M42 180 L38 160 Q36 150 44 140 L58 130 Q66 125 80 126 L102 128 Q112 130 116 140 L122 160 Q124 172 116 180 Z"
        />
        <path
          className="thinker__rock-facet"
          d="M58 130 L66 152 L60 180 M66 152 L98 146 L116 140"
        />

        {/* The far leg and arm, lighter, behind the body. */}
        <g className="thinker__far">
          <path d="M90 124 L126 120 L120 171 L134 174" strokeWidth="17" />
          <path d="M104 88 L118 113 L136 118" strokeWidth="11" />
        </g>

        <path className="thinker__leg" d="M84 124 L130 118 L128 170 L145 173" strokeWidth="18" />

        {/* What breathes: the torso, the head and the arm that holds it. */}
        <g className="thinker__body">
          <path d="M74 126 C 70 104, 82 86, 100 78 C 112 73, 122 80, 120 90 C 117 102, 104 112, 100 128 Z" />
          <path className="thinker__limb" d="M110 82 L121 72" strokeWidth="10" />
          <ellipse cx="127" cy="64" rx="12.5" ry="13.5" />
          <path className="thinker__limb" d="M108 86 L128 113 L130 82" strokeWidth="12" />
          <circle cx="131" cy="79" r="6.5" />
        </g>

        {/* The thoughts: two bubbles and a cloud, in which the ideas change. */}
        <g className="thinker__thoughts">
          <circle className="thinker__bubble thinker__bubble--1" cx="144" cy="47" r="3" />
          <circle className="thinker__bubble thinker__bubble--2" cx="153" cy="36" r="5" />
          <g className="thinker__bubble thinker__bubble--3">
            <path
              className="thinker__cloud"
              d="M158 26 a10 10 0 0 1 8-14 a12 12 0 0 1 20-2 a10 10 0 0 1 10 14 a9 9 0 0 1-6 14 a11 11 0 0 1-18 2 a10 10 0 0 1-14-14z"
            />
            {["?", "∃", "∴", "∞"].map((idea) => (
              <text key={idea} className="thinker__idea" x="176" y="25">
                {idea}
              </text>
            ))}
          </g>
        </g>
      </svg>
      <span className="thinking__caption">{caption}</span>
    </span>
  );
}
