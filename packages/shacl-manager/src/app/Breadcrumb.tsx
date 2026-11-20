import type { BlankNode, NamedNode } from "@rdfjs/types";
import { Suspense } from "react";
import { Link, useMatch } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { segmentToTerm, termToSegment } from "../data-model/segments.ts";
import { findTrail, type TreeNode } from "../data-model/tree.ts";
import { useClassSections } from "../owl/useClassTree.ts";
import { useShapeSections, type Origin } from "../shacl/useShapeTree.ts";
import { origins, perspectives } from "./Sidebar.tsx";
import { termLabel, termTitle } from "./termLabel.ts";

type Sections = { hierarchy: TreeNode[]; other: TreeNode[] };
type Selection = {
  kind: "shape" | "shapeClass" | "group" | "class";
  segment: string;
  linkTo: (segment: string) => string;
  // Absent when the selection has no place in a sidebar tree, so its breadcrumb stays flat.
  useSections?: (origin: Origin) => Sections;
  origin: Origin;
};

// The sidebar selection, read from the URL like the sidebar itself does.
function useSelection(): Selection | undefined {
  const shape = useMatch("/shapes/:origin/shape/:segment/*");
  const shapeClass = useMatch("/shapes/:origin/class/:segment/*");
  const group = useMatch("/shapes/:origin/group/:segment/*");
  const knowledge = useMatch("/knowledge/:origin/:segment/*");

  if (shape) {
    const origin = shape.params.origin as Origin;
    return {
      kind: "shape",
      segment: shape.params.segment!,
      origin,
      useSections: useShapeSections,
      linkTo: (segment) => `/shapes/${origin}/shape/${segment}`,
    };
  }
  if (shapeClass) {
    const origin = shapeClass.params.origin as Origin;
    return {
      kind: "shapeClass",
      segment: shapeClass.params.segment!,
      origin,
      linkTo: (segment) => `/shapes/${origin}/class/${segment}`,
    };
  }
  if (group) {
    const origin = group.params.origin as Origin;
    return {
      kind: "group",
      segment: group.params.segment!,
      origin,
      linkTo: (segment) => `/shapes/${origin}/group/${segment}`,
    };
  }
  if (knowledge) {
    const origin = knowledge.params.origin as Origin;
    return {
      kind: "class",
      segment: knowledge.params.segment!,
      origin,
      useSections: useClassSections,
      linkTo: (segment) => `/knowledge/${origin}/${segment}`,
    };
  }
  return undefined;
}

// Where the sidebar selection sits: its perspective and origin tab, then for a shape in the shapes
// "Hierarchy" or a class in the knowledge "Hierarchy" its trail of ancestors down to itself; any
// other selection is a single crumb.
export function Breadcrumb() {
  const tabs = useMatch("/:perspective/:origin/*");
  const selection = useSelection();
  const perspective = perspectives.find((tab) => tab.path === tabs?.params.perspective);
  const origin = origins.find((tab) => tab.path === tabs?.params.origin);
  if (!perspective || !origin) return null;

  return (
    <nav className="st-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to={`/${perspective.path}/${origin.path}`}>{perspective.label}</Link>
        </li>
        <li>
          <Link to={`/${perspective.path}/${origin.path}`}>{origin.label}</Link>
        </li>
        {selection && (
          // Keyed by kind as well, so Trail remounts when useSections changes and its hooks keep
          // their order; by segment, so a stale trail never shows while the next one loads.
          <Suspense
            key={`${selection.kind} ${selection.segment}`}
            fallback={<Crumbs terms={[]} selection={selection} />}
          >
            <Trail selection={selection} />
          </Suspense>
        )}
      </ol>
    </nav>
  );
}

function Trail({ selection }: { selection: Selection }) {
  const { segment, origin, useSections } = selection;
  const dataModel = useDataModel();
  const sections = useSections?.(origin);
  // The route param arrives decoded while termToSegment encodes, so compare the terms themselves.
  // A blank node is compared by its content id, the same in the URL and in the tree.
  const selected = segmentToTerm(segment, dataModel);
  const isTarget = (node: TreeNode) =>
    !!selected &&
    node.term.termType === selected.termType &&
    (selected.termType === "NamedNode"
      ? node.term.value === selected.value
      : termToSegment(node.term, dataModel) === termToSegment(selected, dataModel));
  const trail = sections && findTrail(sections.hierarchy, isTarget);
  return <Crumbs terms={trail?.map((node) => node.term) ?? []} selection={selection} />;
}

// The trail's terms, or - when it is empty - just the selection itself.
function Crumbs({
  terms,
  selection: { segment, linkTo },
}: {
  terms: (NamedNode | BlankNode)[];
  selection: Selection;
}) {
  const dataModel = useDataModel();
  const self = segmentToTerm(segment, dataModel);
  const crumbs = terms.length ? terms : self ? [self] : [];

  return crumbs.map((term, index) => (
    <li key={`${term.value}-${index}`}>
      <Link to={linkTo(termToSegment(term, dataModel))} title={termTitle(term, dataModel)}>
        {termLabel(term, dataModel)}
      </Link>
    </li>
  ));
}
