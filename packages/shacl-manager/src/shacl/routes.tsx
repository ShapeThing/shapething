import { Navigate, type RouteObject } from "react-router";
import { editRoute, newRoute } from "../app/edit/routes.ts";
import { KeepAliveOutlet } from "../app/KeepAliveOutlet.tsx";
import { MetaPage } from "../app/MetaView.tsx";
import { OriginIntro } from "../app/OriginIntro.tsx";
import { route } from "../app/route.tsx";
import { listTabs, type ListTab } from "./listTabs.ts";
import { shaclMeta } from "./metaShapes.ts";
import { ShapeUsage } from "./ShapeUsage.tsx";
import {
  PropertiesCount,
  QueriesCount,
  RulesCount,
  SubjectList,
  SubjectMeta,
} from "./subjectPages.tsx";

// A subject's Edit button is in its section's heading; its dialog's route is below the Meta tab.
const subjectEdit = { edit: { shapes: shaclMeta.shape.edit, at: "meta" } };

const metaRoute: RouteObject = {
  path: "meta",
  element: <SubjectMeta />,
  handle: { label: "Meta" },
  children: [editRoute],
};

const listRoute = (path: string, tab: ListTab, Count: () => React.ReactNode): RouteObject => ({
  path,
  element: <SubjectList tab={tab} />,
  handle: { label: tab.label, Count },
  children: [
    {
      path: `:${tab.param}`,
      element: (
        <MetaPage
          param={tab.param}
          shapes={tab.shapes}
          actions={{ deactivate: true, delete: true }}
          heading={{ type: tab.create.type, label: tab.fallbackLabel }}
        >
          <ShapeUsage tab={tab} path={path} />
        </MetaPage>
      ),
      children: [editRoute],
    },
    newRoute(),
  ],
});

const propertiesRoute = listRoute("properties", listTabs.properties, PropertiesCount);

// class/:class gathers what the origin's shapes say about a class; shape/:shape is one shape.
const subjectRoute = (kind: "class" | "shape", title: string): RouteObject =>
  route(
    `${kind}/:${kind}`,
    title,
    [
      { index: true, element: <Navigate to="meta" replace /> },
      metaRoute,
      propertiesRoute,
      listRoute("queries", listTabs.queries, QueriesCount),
      listRoute("rules", listTabs.rules, RulesCount),
    ],
    // A class page gathers what several shapes say: nothing of its own to edit or delete.
    { actions: kind === "shape" ? { ...subjectEdit, delete: true, deactivate: true } : {} },
  );

// A property group gathers property shapes from any shape, so it is a subject of its own.
const groupRoute = (): RouteObject =>
  route(
    "group/:group",
    "Property group",
    [{ index: true, element: <Navigate to="meta" replace /> }, metaRoute, propertiesRoute],
    { actions: { ...subjectEdit, delete: true } },
  );

const originRoute = (origin: "managed" | "imported", title: string) =>
  route(origin, title, [
    { index: true, element: <OriginIntro perspective="shapes" origin={origin} /> },
    subjectRoute("class", "Class"),
    subjectRoute("shape", "Shape"),
    groupRoute(),
    ...(origin === "managed" ? [newRoute("new/shape"), newRoute("new/group")] : []),
  ]);

export const shaclRoutes: RouteObject = {
  path: "shapes",
  element: <KeepAliveOutlet />,
  children: [
    { index: true, element: <Navigate to="managed" replace /> },
    originRoute("managed", "Managed"),
    originRoute("imported", "Imported"),
  ],
};
