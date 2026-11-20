import { Suspense } from "react";
import { Link, useMatch } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import type { Resource } from "../data-model/rdf.ts";
import { segmentToTerm, termToSegment } from "../data-model/segments.ts";
import { useCached } from "../data-model/storeCache.ts";
import { findTrail, type Sections, type TreeNode } from "../data-model/tree.ts";
import { classSections } from "../owl/useClassTree.ts";
import { findListTab, type ListTab } from "../shacl/listTabs.ts";
import { useItemLabel } from "../shacl/subjectPages.tsx";
import { shapeSections } from "../shacl/useShapeTree.ts";
import { NEW } from "./edit/routes.ts";
import {
  classPath,
  originPath,
  origins,
  perspectives,
  subjectPath,
  type Origin,
  type SubjectKind,
} from "./paths.ts";
import { termTitle, useTermLabel } from "./termLabel.ts";

type Selection = {
  segment: string;
  origin: Origin;
  linkTo: (segment: string) => string;
  // The sidebar tree it sits in, for its trail of ancestors; without one the crumb stays flat.
  sections?: (dataModel: DataModel, origin: Origin) => Promise<Sections>;
  // The open tab, and the item open in it.
  tab?: { path: string; label: string; listTab?: ListTab };
  item?: string;
};

const notNew = (segment: string | undefined) => (segment === NEW ? undefined : segment);

const kinds: readonly string[] = ["shape", "class", "group"] satisfies SubjectKind[];

function useSelection(): Selection | undefined {
  const shapes = useMatch("/shapes/:origin/:kind/:segment/:tab?/:item?/*")?.params;
  const knowledge = useMatch("/knowledge/:origin/:segment/:tab?/:item?/*")?.params;

  if (shapes?.kind && kinds.includes(shapes.kind) && shapes.segment) {
    const origin = shapes.origin as Origin;
    const kind = shapes.kind as SubjectKind;
    const listTab = findListTab(shapes.tab);
    return {
      segment: shapes.segment,
      origin,
      linkTo: (segment) => subjectPath(origin, kind, segment),
      sections: kind === "shape" ? shapeSections : undefined,
      tab: listTab && { path: shapes.tab!, label: listTab.label, listTab },
      item: notNew(shapes.item),
    };
  }
  const segment = notNew(knowledge?.segment);
  if (knowledge && segment) {
    const origin = knowledge.origin as Origin;
    return {
      segment,
      origin,
      linkTo: (segment) => classPath(origin, segment),
      sections: classSections,
      tab: knowledge.tab === "properties" ? { path: "properties", label: "Properties" } : undefined,
      item: notNew(knowledge.item),
    };
  }
  return undefined;
}

export function Breadcrumb() {
  const params = useMatch("/:perspective/:origin/*")?.params;
  const selection = useSelection();
  const perspective = perspectives.find((tab) => tab.path === params?.perspective);
  const origin = origins.find((tab) => tab.path === params?.origin);
  if (!perspective || !origin) return null;
  const home = originPath(perspective.path, origin.path);

  return (
    <nav className="st-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to={home}>{perspective.label}</Link>
        </li>
        <li>
          <Link to={home}>{origin.label}</Link>
        </li>
        {selection && (
          <Suspense key={selection.segment} fallback={<Crumbs selection={selection} />}>
            <Trail selection={selection} />
          </Suspense>
        )}
      </ol>
    </nav>
  );
}

function Trail({ selection }: { selection: Selection }) {
  const dataModel = useDataModel();
  if (!selection.sections) return <Crumbs selection={selection} />;
  return (
    <TreeTrail selection={selection} sections={selection.sections(dataModel, selection.origin)} />
  );
}

function TreeTrail({
  selection,
  sections: loading,
}: {
  selection: Selection;
  sections: Promise<Sections>;
}) {
  const dataModel = useDataModel();
  const sections = useCached(loading);
  const selected = segmentToTerm(selection.segment, dataModel);
  // The URL segment arrives decoded, so compare by term, and a blank node by its content id.
  const isTarget = (node: TreeNode) =>
    !!selected &&
    node.term.termType === selected.termType &&
    (selected.termType === "NamedNode"
      ? node.term.value === selected.value
      : termToSegment(node.term, dataModel) === termToSegment(selected, dataModel));
  const trail = findTrail(sections.hierarchy, isTarget);
  return <Crumbs trail={trail?.map((node) => node.term)} selection={selection} />;
}

function Crumbs({ trail = [], selection }: { trail?: Resource[]; selection: Selection }) {
  const dataModel = useDataModel();
  const self = segmentToTerm(selection.segment, dataModel);
  const crumbs = trail.length ? trail : self ? [self] : [];

  return (
    <>
      {crumbs.map((term, index) => (
        <Crumb key={index} term={term} to={selection.linkTo(termToSegment(term, dataModel))} />
      ))}
      {self && selection.tab && <TabCrumbs self={self} selection={selection} />}
    </>
  );
}

function Crumb({ term, to, label }: { term: Resource; to: string; label?: string }) {
  const dataModel = useDataModel();
  const termLabel = useTermLabel();
  return (
    <li>
      <Link to={to} title={termTitle(term, dataModel)}>
        {label ?? termLabel(term)}
      </Link>
    </li>
  );
}

function TabCrumbs({ self, selection }: { self: Resource; selection: Selection }) {
  const dataModel = useDataModel();
  const itemLabel = useItemLabel(selection.tab?.listTab);
  const tabPath = `${selection.linkTo(termToSegment(self, dataModel))}/${selection.tab!.path}`;
  const item = selection.item ? segmentToTerm(selection.item, dataModel) : undefined;

  return (
    <>
      <li>
        <Link to={tabPath}>{selection.tab!.label}</Link>
      </li>
      {item && (
        <Crumb
          term={item}
          to={`${tabPath}/${termToSegment(item, dataModel)}`}
          label={itemLabel(item)}
        />
      )}
    </>
  );
}
