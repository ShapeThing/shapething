import { Link } from "@tanstack/react-router";
import { useLabels } from "@/data-model/useLabels.ts";
import { termKey } from "@/helpers/iri.ts";
import type { NodeShape } from "@/shapes/model.ts";

/**
 * A node shape. With `onToggle` it is a selection toggle (the focus view's hierarchy). With
 * `owlClass` it opens that class's view, which shows every shape targeting the class together;
 * without, the shape's own view.
 */
export default function ShapeChip({
  shape,
  count,
  active,
  owlClass,
  selected,
  onToggle,
}: {
  shape: NodeShape;
  count?: number;
  active?: boolean;
  owlClass?: string;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const labels = useLabels();
  const implicit = shape.targets.some((t) => t.kind === "implicitClass");
  const className = `st-manager-chip${active ? " st-manager-chip--active" : ""}`;
  const content = (
    <>
      <span aria-hidden="true">◆</span> {labels.display(shape.term)}
      {implicit && <span className="st-manager-chip__meta">implicit</span>}
      {count !== undefined && <span className="st-manager-chip__meta">{count}</span>}
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className={`${className} st-manager-chip--toggle`}
        title={shape.term.value}
      >
        {content}
      </button>
    );
  }

  return owlClass ? (
    <Link
      to="/class/$class"
      params={{ class: encodeURIComponent(owlClass) }}
      className={className}
      title={shape.term.value}
    >
      {content}
    </Link>
  ) : (
    <Link
      to="/shape/$shape"
      params={{ shape: encodeURIComponent(termKey(shape.term)) }}
      className={className}
      title={shape.term.value}
    >
      {content}
    </Link>
  );
}
