import { Navigate, type RouteObject } from "react-router";
import { route } from "../app/route.tsx";
import { ClassMeta } from "./pages/ClassMeta/index.tsx";
import { ClassProperty } from "./pages/ClassProperty/index.tsx";

const classRoute = (): RouteObject =>
  route(":class", "Class", [
    { index: true, element: <Navigate to="meta" replace /> },
    { path: "meta", element: <ClassMeta /> },
    route("properties", "Properties", [{ path: ":property", element: <ClassProperty /> }]),
  ]);

export const owlRoutes: RouteObject = {
  // No element: the sidebar renders the managed/imported tabs.
  path: "knowledge",
  children: [
    { index: true, element: <Navigate to="managed" replace /> },
    route("managed", "Managed", [classRoute()]),
    route("imported", "Imported", [classRoute()]),
  ],
};
