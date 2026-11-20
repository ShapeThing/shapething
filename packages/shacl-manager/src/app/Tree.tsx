import { NavLink } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { deactivatedClass } from "../data-model/editGraphs.ts";
import { termKey } from "../data-model/rdf.ts";
import { termToSegment } from "../data-model/segments.ts";
import type { TreeNode } from "../data-model/tree.ts";
import { termTitle, useTermLabel } from "./termLabel.ts";

type TreeProps = {
  nodes: TreeNode[];
  linkTo: (segment: string) => string;
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

function TreeItem({ node, linkTo }: Omit<TreeProps, "nodes"> & { node: TreeNode }) {
  const dataModel = useDataModel();
  const termLabel = useTermLabel();
  const { term, count } = node;

  const page = linkTo(termToSegment(term, dataModel));
  const entry = (
    <NavLink
      to={page}
      title={termTitle(term, dataModel)}
      className={deactivatedClass(dataModel, term)}
    >
      {termLabel(term)}
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
