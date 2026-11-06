import type { WidgetProps } from "@shapething/shacl-renderer";
import { relativeInfluence, useInfluenceScale } from "../../influence/influenceScale.ts";
import "./style.scss";

const describe = (count: number) =>
  count === 1 ? "Influenced 1 person" : `Influenced ${count.toLocaleString("en")} people`;

/**
 * inf:RelativeInfluenceViewer: an influence count (inf:influenceCount) as a bar, filled by how the
 * count ranks among the people shown in the app at the moment. That scale comes from the page
 * around the renderer (InfluenceScaleContext), so the bars change when a column is opened or
 * closed, without rendering the shapes again.
 */
export default function RelativeInfluenceViewer({ term, labelledBy }: WidgetProps) {
  const scale = useInfluenceScale();
  const count = Number.parseInt(term.value, 10);

  if (term.termType !== "Literal" || !Number.isFinite(count)) {
    return <span className="relative-influence">{term.value}</span>;
  }

  const relative = relativeInfluence(scale, count);
  const description = describe(count);

  return (
    <span className="relative-influence" title={description}>
      {relative !== undefined && (
        <span
          className="relative-influence__track"
          role="meter"
          aria-labelledby={labelledBy}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={relative}
          aria-valuetext={`${description}, ranking ${relative} out of 100 among the people shown`}
        >
          <span className="relative-influence__bar" style={{ width: `${relative}%` }} />
        </span>
      )}
      <span className="relative-influence__count">{description}</span>
    </span>
  );
}
