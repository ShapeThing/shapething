import { NavLink } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { deactivatedClass } from "../data-model/editGraphs.ts";
import { termKey } from "../data-model/rdf.ts";
import { termToSegment } from "../data-model/segments.ts";
import type { TreeNode } from "../data-model/tree.ts";
import { ownLabel, sourceLabel } from "./navigation/navigation.ts";
import { termTitle, useTermLabel } from "./termLabel.ts";

type TreeProps = {
  nodes: TreeNode[];
  // The node is there for trees that mix kinds and origins, such as the sidebar's.
  linkTo: (segment: string, node: TreeNode) => string;
};

export function Tree({ nodes, ...props }: TreeProps) {
  return (
    <ul className="st-tree">
      {nodes.map((node, index) => (
        <TreeItem key={`${termKey(node.term)} ${index}`} node={node} {...props} />
      ))}
    </ul>
  );
}

const kindLabels = { class: "Class", shape: "Shape", group: "Property group" };

function TreeItem({ node, linkTo }: Omit<TreeProps, "nodes"> & { node: TreeNode }) {
  const dataModel = useDataModel();
  const termLabel = useTermLabel();
  const { term, count, kind, origin, source, context } = node;

  const ownPrefix = ownLabel(dataModel);

  const page = linkTo(termToSegment(term, dataModel), node);
  // Imported and merely referenced nodes are muted; the data model's own read as normal text.
  const muted = kind && origin !== "managed";
  const title = [
    kind && kindLabels[kind],
    termTitle(term, dataModel),
    source && `From ${source.value}`,
  ]
    .filter(Boolean)
    .join("\n");

  const entry = (
    <NavLink
      to={page}
      title={title}
      className={(state) =>
        [
          deactivatedClass(dataModel, term)(state),
          muted && "st-tree__item--imported",
          context && "st-tree__item--context",
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      {kind && <span className={`st-tree__icon st-tree__icon--${kind}`} aria-hidden="true" />}
      <span className="st-tree__label">{termLabel(term)}</span>
      {source ? (
        <span className="st-tree__source">{sourceLabel(source, dataModel.prefixes)}</span>
      ) : (
        kind &&
        origin === "managed" &&
        ownPrefix && <span className="st-tree__source st-tree__source--own">{ownPrefix}</span>
      )}
      {count !== undefined && <span className="st-tree__count">{count}</span>}
    </NavLink>
  );

  return (
    <li>
      {node.children.length > 0 ? (
        <details open>
          <summary>{entry}</summary>
          <Tree nodes={node.children} linkTo={linkTo} />
        </details>
      ) : (
        entry
      )}
    </li>
  );
}
