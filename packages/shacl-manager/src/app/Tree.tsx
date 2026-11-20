import { NavLink } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { termKey } from "../data-model/rdf.ts";
import { termToSegment } from "../data-model/segments.ts";
import type { TreeNode } from "../data-model/tree.ts";
import { termTitle, useTermLabel } from "./termLabel.ts";

type LinkTo = (segment: string) => string;

export function Tree({ nodes, linkTo }: { nodes: TreeNode[]; linkTo: LinkTo }) {
  return (
    <ul className="st-tree">
      {nodes.map((node, index) => (
        <TreeItem key={`${termKey(node.term)} ${index}`} node={node} linkTo={linkTo} />
      ))}
    </ul>
  );
}

function TreeItem({ node, linkTo }: { node: TreeNode; linkTo: LinkTo }) {
  const dataModel = useDataModel();
  const termLabel = useTermLabel();
  const { term, propertyCount } = node;

  const entry = (
    <NavLink to={linkTo(termToSegment(term, dataModel))} title={termTitle(term, dataModel)}>
      {termLabel(term)}
      {propertyCount !== undefined && <span className="st-tree__count">{propertyCount}</span>}
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
