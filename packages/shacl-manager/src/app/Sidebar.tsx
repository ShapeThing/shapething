import { owl, sh } from "@shapething/shacl-renderer";
import { Suspense } from "react";
import { NavLink } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { cached, useCached } from "../data-model/storeCache.ts";
import { countNodes } from "../data-model/tree.ts";
import { owlMeta } from "../owl/metaShapes.ts";
import { classSections, useClassSections } from "../owl/useClassTree.ts";
import { shaclMeta } from "../shacl/metaShapes.ts";
import { usePropertyGroups } from "../shacl/usePropertyGroups.ts";
import { shapeSections, useShapeSections } from "../shacl/useShapeTree.ts";
import { CreateButton } from "./edit/CreateButton.tsx";
import {
  classPath,
  originPath,
  origins,
  perspectives,
  subjectPath,
  useOrigin,
  usePerspective,
  type Origin,
  type Perspective,
} from "./paths.ts";
import { Tree } from "./Tree.tsx";

const allOrigins: Origin[] = origins.map((tab) => tab.path);

// Switching perspective keeps the current origin and vice versa.
export function Sidebar() {
  const perspective = usePerspective();
  const origin = useOrigin();

  return (
    <aside className="st-manager__sidebar">
      <nav className="st-manager__tabs st-manager__tabs--primary">
        {perspectives.map((tab) => (
          <NavLink key={tab.path} to={originPath(tab.path, origin)}>
            {tab.label}
            <TabCount perspective={tab.path} origins={allOrigins} />
          </NavLink>
        ))}
      </nav>
      <nav className="st-manager__tabs st-manager__tabs--secondary">
        {origins.map((tab) => (
          <NavLink key={tab.path} to={originPath(perspective, tab.path)}>
            {tab.label}
            <TabCount perspective={perspective} origins={[tab.path]} />
          </NavLink>
        ))}
      </nav>
      <div className="st-manager__sidebar-content">
        {perspective === "shapes" ? (
          <Suspense fallback="Loading shapes…">
            <ShapesSidebar origin={origin} />
          </Suspense>
        ) : (
          <Suspense fallback="Loading classes…">
            <ClassesSidebar origin={origin} />
          </Suspense>
        )}
      </div>
    </aside>
  );
}

const sectionsOf = { shapes: shapeSections, knowledge: classSections };

function TabCount({ perspective, origins }: { perspective: Perspective; origins: Origin[] }) {
  return (
    <Suspense key={perspective} fallback={null}>
      <Count perspective={perspective} origins={origins} />
    </Suspense>
  );
}

// The same (cached) queries that fill the sidebar, so a count always matches what is listed.
const countOf = (dataModel: DataModel, perspective: Perspective, origins: Origin[]) =>
  cached(dataModel.store, `count ${perspective} ${origins.join(" ")}`, async () => {
    const sections = await Promise.all(
      origins.map((origin) => sectionsOf[perspective](dataModel, origin)),
    );
    return countNodes(sections.flatMap(({ hierarchy, other }) => [...hierarchy, ...other]));
  });

function Count({ perspective, origins }: { perspective: Perspective; origins: Origin[] }) {
  const count = useCached(countOf(useDataModel(), perspective, origins));
  return <span className="st-manager__tab-count">{count}</span>;
}

function ShapesSidebar({ origin }: { origin: Origin }) {
  const { hierarchy, other } = useShapeSections(origin);
  const groups = usePropertyGroups(origin);
  const shapeLink = (segment: string) => subjectPath(origin, "shape", segment);
  const groupLink = (segment: string) => subjectPath(origin, "group", segment);

  return (
    <>
      <section>
        <header className="st-manager__section-header">
          <h3>Hierarchy</h3>
          {origin === "managed" && (
            <CreateButton
              {...shaclMeta.shape.edit}
              label="shape"
              kind="shape"
              type={sh("NodeShape")}
              path="/shapes/managed/new/shape"
              back="/shapes/managed"
              to={shapeLink}
            />
          )}
        </header>
        <Tree nodes={hierarchy} linkTo={shapeLink} />
      </section>
      <section>
        <h3>Other shapes</h3>
        <Tree nodes={other} linkTo={shapeLink} />
      </section>
      <section>
        <header className="st-manager__section-header">
          <h3>Groups</h3>
          {origin === "managed" && (
            <CreateButton
              {...shaclMeta.shape.edit}
              label="group"
              kind="group"
              type={sh("PropertyGroup")}
              path="/shapes/managed/new/group"
              back="/shapes/managed"
              to={groupLink}
            />
          )}
        </header>
        <Tree nodes={groups} linkTo={groupLink} />
      </section>
    </>
  );
}

function ClassesSidebar({ origin }: { origin: Origin }) {
  const { hierarchy, other } = useClassSections(origin);
  const linkTo = (segment: string) => classPath(origin, segment);

  return (
    <>
      <section>
        <header className="st-manager__section-header">
          <h3>Hierarchy</h3>
          {origin === "managed" && (
            <CreateButton
              {...owlMeta.class.edit}
              label="class"
              kind="class"
              type={owl("Class")}
              path="/knowledge/managed/new"
              back="/knowledge/managed"
              to={linkTo}
            />
          )}
        </header>
        <Tree nodes={hierarchy} linkTo={linkTo} />
      </section>
      <section>
        <h3>Anonymous classes</h3>
        <Tree nodes={other} linkTo={linkTo} />
      </section>
    </>
  );
}
