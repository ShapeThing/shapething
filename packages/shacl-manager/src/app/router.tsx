import { createHashRouter, Navigate } from "react-router";
import { Layout } from "./Layout.tsx";
import { shaclRoutes } from "../shacl/routes.tsx";
import { owlRoutes } from "../owl/routes.tsx";

// The route lives in the URL after the hash, so the host page's own path and query stay untouched
// while the current view survives reloads and can be linked to.
export function createShaclManagerRouter() {
  return createHashRouter([
    {
      path: "/",
      element: <Layout />,
      children: [
        { index: true, element: <Navigate to="shapes/managed" replace /> },
        shaclRoutes,
        owlRoutes,
      ],
    },
  ]);
}
