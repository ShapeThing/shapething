import { Link } from "@tanstack/react-router";
import { useT } from "@/app/useT.ts";
import { useDataModel } from "@/data-model/useDataModel.ts";
import { useLabels } from "@/data-model/useLabels.ts";
import { compactIri } from "@/helpers/iri.ts";
import type { ClassTreeNode } from "@/ontology/model.ts";
import type { NodeShape, PropertyShape } from "@/shapes/model.ts";
import ShapeChip from "@/views/ShapeChip.tsx";

type Props = {
  forest: ClassTreeNode[];
  shapesByClass: Map<string, NodeShape[]>;
  propertyShapes: Map<string, PropertyShape[]>;
  /** Classes that render expanded; everything else starts collapsed. */
  open: (node: ClassTreeNode, depth: number) => boolean;
  focusClasses?: ReadonlySet<string>;
  /** Turns the shape chips into selection toggles. */
  shapeSelection?: { hidden: ReadonlySet<string>; toggle: (shapeKey: string) => void };
  /** Which shapes to show as chips; all by default. */
  showShape?: (shape: NodeShape) => boolean;
};

export default function ClassTree(props: Props) {
  return <Level {...props} nodes={props.forest} depth={0} />;
}

function Level({ nodes, depth, ...props }: Props & { nodes: ClassTreeNode[]; depth: number }) {
  if (nodes.length === 0) return null;
  return (
    <ul className="st-manager-tree" role={depth === 0 ? "tree" : "group"}>
      {nodes.map((node) => (
        <Item key={node.owlClass.iri} node={node} depth={depth} {...props} />
      ))}
    </ul>
  );
}

function Item({ node, depth, ...props }: Props & { node: ClassTreeNode; depth: number }) {
  const { isEditable } = useDataModel();
  const labels = useLabels();
  const t = useT();
  const { owlClass } = node;
  const shapes = (props.shapesByClass.get(owlClass.iri) ?? []).filter(
    (shape) => props.showShape?.(shape) ?? true,
  );
  const focused = props.focusClasses?.has(owlClass.iri);

  const row = (
    <span className="st-manager-tree__row">
      <Link
        to="/class/$class"
        params={{ class: encodeURIComponent(owlClass.iri) }}
        className={`st-manager-tree__class${focused ? " st-manager-tree__class--focus" : ""}`}
        title={owlClass.iri}
      >
        {labels.display(owlClass.term)}
      </Link>
      <span className="st-manager-tree__iri">{compactIri(owlClass.iri)}</span>
      {!isEditable(owlClass.term) && (
        <span className="st-manager-badge">{t("shacl-manager-imported", null, "import")}</span>
      )}
      <span className="st-manager-tree__shapes">
        {shapes.map((shape) => (
          <ShapeChip
            key={shape.key}
            shape={shape}
            count={props.propertyShapes.get(shape.key)?.length ?? 0}
            owlClass={owlClass.iri}
            selected={props.shapeSelection && !props.shapeSelection.hidden.has(shape.key)}
            onToggle={props.shapeSelection && (() => props.shapeSelection!.toggle(shape.key))}
          />
        ))}
      </span>
    </span>
  );

  return (
    <li role="treeitem" aria-expanded={node.children.length ? props.open(node, depth) : undefined}>
      {node.children.length ? (
        <details open={props.open(node, depth)}>
          <summary>{row}</summary>
          <Level {...props} nodes={node.children} depth={depth + 1} />
        </details>
      ) : (
        <div className="st-manager-tree__leaf">{row}</div>
      )}
    </li>
  );
}
