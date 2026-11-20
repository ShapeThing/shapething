import { Navigate, type RouteObject } from "react-router";
import { route } from "../app/route.tsx";
import { ShapeMeta } from "./pages/ShapeMeta/index.tsx";
import { ShapeProperties } from "./pages/ShapeProperties/index.tsx";
import { ShapeProperty } from "./pages/ShapeProperty/index.tsx";
import { ShapeQueries } from "./pages/ShapeQueries/index.tsx";
import { ShapeQuery } from "./pages/ShapeQuery/index.tsx";
import { ShapeRule } from "./pages/ShapeRule/index.tsx";
import { ShapeRules } from "./pages/ShapeRules/index.tsx";
import { PropertiesCount, QueriesCount, RulesCount } from "./tabCounts.tsx";

const propertiesRoute: RouteObject = {
  path: "properties",
  element: <ShapeProperties />,
  handle: { Count: PropertiesCount },
  children: [{ path: ":property", element: <ShapeProperty /> }],
};

// class/:class is everything this origin's shapes say about a class (read-only overview);
// shape/:shape is one shape's own content, where editing happens. Both take an IRI as a prefixed
// name when one fits (skos:Concept), else the full IRI - see data-model/prefixes.ts.
const subjectRoute = (kind: "class" | "shape", title: string): RouteObject =>
  route(`${kind}/:${kind}`, title, [
    { index: true, element: <Navigate to="meta" replace /> },
    { path: "meta", element: <ShapeMeta /> },
    propertiesRoute,
    {
      path: "queries",
      element: <ShapeQueries />,
      handle: { Count: QueriesCount },
      children: [{ path: ":constraint", element: <ShapeQuery /> }],
    },
    {
      path: "rules",
      element: <ShapeRules />,
      handle: { Count: RulesCount },
      children: [{ path: ":rule", element: <ShapeRule /> }],
    },
  ]);

// group/:group is a property group (sh:PropertyGroup): its own subject beside classes and shapes,
// not nested under a shape, since one group gathers property shapes from any shape.
const groupRoute = (): RouteObject =>
  route("group/:group", "Property group", [
    { index: true, element: <Navigate to="meta" replace /> },
    { path: "meta", element: <ShapeMeta /> },
    propertiesRoute,
  ]);

const originRoute = (origin: "managed" | "imported", title: string) =>
  route(origin, title, [
    subjectRoute("class", "Class"),
    subjectRoute("shape", "Shape"),
    groupRoute(),
  ]);

export const shaclRoutes: RouteObject = {
  // No element: the sidebar renders the managed/imported tabs.
  path: "shapes",
  children: [
    { index: true, element: <Navigate to="managed" replace /> },
    originRoute("managed", "Managed"),
    originRoute("imported", "Imported"),
  ],
};
