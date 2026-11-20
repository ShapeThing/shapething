import { createHashRouter, Navigate } from "react-router";
import { owlRoutes } from "../owl/routes.tsx";
import { shaclRoutes } from "../shacl/routes.tsx";
import { Layout } from "./Layout.tsx";

// In the hash, so the host page's own path and query stay untouched.
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
