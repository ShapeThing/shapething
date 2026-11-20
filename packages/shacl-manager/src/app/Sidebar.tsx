import { Suspense } from "react";
import { NavLink, useMatch } from "react-router";
import { useClassSections } from "../owl/useClassTree.ts";
import { countNodes } from "../data-model/tree.ts";
import { usePropertyGroups } from "../shacl/usePropertyGroups.ts";
import { useShapeSections } from "../shacl/useShapeTree.ts";
import { Tree } from "./Tree.tsx";

export const perspectives = [
  { path: "shapes", label: "Shapes" },
  { path: "knowledge", label: "Knowledge" },
] as const;

export const origins = [
  { path: "managed", label: "Managed" },
  { path: "imported", label: "Imported" },
] as const;

const allOrigins: Origin[] = origins.map((tab) => tab.path);

type Perspective = (typeof perspectives)[number]["path"];
type Origin = (typeof origins)[number]["path"];

// Both tab rows are derived from the URL (/:perspective/:origin/...), so the router stays the
// single source of truth. Switching perspective keeps the current origin and vice versa.
export function Sidebar() {
  const match = useMatch("/:perspective/:origin/*");
  const perspective = (match?.params.perspective ?? "shapes") as Perspective;
  const origin = (match?.params.origin ?? "managed") as Origin;

  return (
    <aside className="st-manager__sidebar">
      <nav className="st-manager__tabs">
        {perspectives.map((tab) => (
          <NavLink key={tab.path} to={`/${tab.path}/${origin}`}>
            {tab.label}
            <TabCount perspective={tab.path} origins={allOrigins} />
          </NavLink>
        ))}
      </nav>
      <nav className="st-manager__tabs st-manager__tabs--secondary">
        {origins.map((tab) => (
          <NavLink key={tab.path} to={`/${perspective}/${tab.path}`}>
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

const useSections = { shapes: useShapeSections, knowledge: useClassSections };

// The number of shapes or classes beneath a tab: a perspective tab counts both origins, an origin
// tab only its own. It reuses the same (cached) queries that fill the sidebar, so a count always
// matches what is listed. Blank until they are loaded.
function TabCount({ perspective, origins }: { perspective: Perspective; origins: Origin[] }) {
  return (
    <Suspense key={perspective} fallback={null}>
      <Count perspective={perspective} origins={origins} />
    </Suspense>
  );
}

function Count({ perspective, origins }: { perspective: Perspective; origins: Origin[] }) {
  const useOrigin = useSections[perspective];
  // origins is a fixed list per tab, so the hooks are called in the same order on every render.
  const nodes = origins.flatMap((origin) => {
    const { hierarchy, other } = useOrigin(origin);
    return [...hierarchy, ...other];
  });
  return <span className="st-manager__tab-count">{countNodes(nodes)}</span>;
}

// "Hierarchy" holds every shape with an sh:targetClass, nested by rdfs:subClassOf of the targeted
// classes; "Other shapes" holds exactly the rest (see shacl/shapeHierarchy.rq). Both keep the
// query's order: most sh:property first. "Property groups" lists the origin's sh:PropertyGroups
// (see shacl/propertyGroups.rq), by sh:order.
function ShapesSidebar({ origin }: { origin: Origin }) {
  const { hierarchy, other } = useShapeSections(origin);
  const groups = usePropertyGroups(origin);
  const linkTo = (segment: string) => `/shapes/${origin}/shape/${segment}`;

  return (
    <>
      <section>
        <h3>Hierarchy</h3>
        <Tree nodes={hierarchy} linkTo={linkTo} />
      </section>
      <section>
        <h3>Other shapes</h3>
        <Tree nodes={other} linkTo={linkTo} />
      </section>
      <section>
        <h3>Property groups</h3>
        <Tree nodes={groups} linkTo={(segment) => `/shapes/${origin}/group/${segment}`} />
      </section>
    </>
  );
}

// "Hierarchy" holds every named class, nested by rdfs:subClassOf; "Anonymous classes" holds exactly
// the rest - restrictions, unionOf and other blank-node classes (see owl/classHierarchy.rq). Both
// keep the query's order: most properties (by rdfs:domain) first.
function ClassesSidebar({ origin }: { origin: Origin }) {
  const { hierarchy, other } = useClassSections(origin);
  const linkTo = (segment: string) => `/knowledge/${origin}/${segment}`;

  return (
    <>
      <section>
        <h3>Hierarchy</h3>
        <Tree nodes={hierarchy} linkTo={linkTo} />
      </section>
      <section>
        <h3>Anonymous classes</h3>
        <Tree nodes={other} linkTo={linkTo} />
      </section>
    </>
  );
}
