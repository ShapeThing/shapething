import { NavLink } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { termToSegment } from "../data-model/segments.ts";
import type { TreeNode } from "../data-model/tree.ts";
import { termLabel, termTitle } from "./termLabel.ts";

type LinkTo = (segment: string) => string;

// A sidebar hierarchy (shapes, classes, property groups). `linkTo` turns a node's URL segment into
// its route.
export function Tree({ nodes, linkTo }: { nodes: TreeNode[]; linkTo: LinkTo }) {
  return (
    <ul className="st-tree">
      {nodes.map((node, index) => (
        <TreeItem key={`${node.term.value}-${index}`} node={node} linkTo={linkTo} />
      ))}
    </ul>
  );
}

function TreeItem({ node, linkTo }: { node: TreeNode; linkTo: LinkTo }) {
  const dataModel = useDataModel();
  const { term, propertyCount } = node;

  // A blank node links by a hash of its content (data-model/blankNodes.ts).
  const entry = (
    <NavLink to={linkTo(termToSegment(term, dataModel))} title={termTitle(term, dataModel)}>
      {termLabel(term, dataModel)}
      <span className="st-tree__count">{propertyCount}</span>
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
