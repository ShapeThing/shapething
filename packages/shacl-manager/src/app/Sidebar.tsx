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
import { DataModelLink } from "./DataModelPage.tsx";
import { CreateButton } from "./edit/CreateButton.tsx";
import {
  classPath,
  originPath,
  origins,
  perspectives,
  subjectPath,
  usePlace,
  type Origin,
  type Perspective,
} from "./paths.ts";
import { Tree } from "./Tree.tsx";

const allOrigins: Origin[] = origins.map((tab) => tab.path);

// Switching perspective keeps the current origin and vice versa. Outside of a perspective and
// origin, such as on the data model's page, only the perspectives, leading to their managed part.
export function Sidebar() {
  const place = usePlace();

  return (
    <aside className="st-manager__sidebar">
      <DataModelLink />
      <nav className="st-manager__tabs st-manager__tabs--primary">
        {perspectives.map((tab) => (
          <NavLink key={tab.path} to={originPath(tab.path, place?.origin ?? "managed")}>
            {tab.label}
            <TabCount perspective={tab.path} origins={allOrigins} />
          </NavLink>
        ))}
      </nav>
      {place && (
        <nav className="st-manager__tabs st-manager__tabs--secondary">
          {origins.map((tab) => (
            <NavLink key={tab.path} to={originPath(place.perspective, tab.path)}>
              {tab.label}
              <TabCount perspective={place.perspective} origins={[tab.path]} />
            </NavLink>
          ))}
        </nav>
      )}
      <div className="st-manager__sidebar-content">
        {place?.perspective === "shapes" && (
          <Suspense fallback="Loading shapes…">
            <ShapesSidebar origin={place.origin} />
          </Suspense>
        )}
        {place?.perspective === "knowledge" && (
          <Suspense fallback="Loading classes…">
            <ClassesSidebar origin={place.origin} />
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
