import { Navigate, type RouteObject } from "react-router";
import { editRoute, newRoute } from "../app/edit/routes.ts";
import { MetaPage } from "../app/MetaView.tsx";
import { OriginIntro } from "../app/OriginIntro.tsx";
import { route } from "../app/route.tsx";
import { ClassProperties, ClassPropertiesCount } from "./ClassProperties.tsx";
import { owlMeta } from "./metaShapes.ts";

const classRoute = (): RouteObject =>
  route(":class", "Class", [
    { index: true, element: <Navigate to="meta" replace /> },
    {
      path: "meta",
      element: <MetaPage param="class" shapes={owlMeta.class} />,
      handle: { label: "Meta" },
      children: [editRoute],
    },
    {
      path: "properties",
      element: <ClassProperties />,
      handle: { label: "Properties", Count: ClassPropertiesCount },
      children: [
        {
          path: ":property",
          element: <MetaPage param="property" shapes={owlMeta.property} />,
          children: [editRoute],
        },
        newRoute(),
      ],
    },
  ]);

export const owlRoutes: RouteObject = {
  path: "knowledge",
  children: [
    { index: true, element: <Navigate to="managed" replace /> },
    route("managed", "Managed", [
      { index: true, element: <OriginIntro perspective="knowledge" origin="managed" /> },
      classRoute(),
      newRoute(),
    ]),
    route("imported", "Imported", [
      { index: true, element: <OriginIntro perspective="knowledge" origin="imported" /> },
      classRoute(),
    ]),
  ],
};
