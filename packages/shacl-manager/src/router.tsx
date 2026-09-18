import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import Layout from "@/components/Layout";
import IndexRoute from "@/routes/index";
import DataModelRoute from "@/routes/DataModelRoute";
import ClassRoute from "@/routes/ClassRoute";
import ShapeRoute from "@/routes/ShapeRoute";

export type RouterContext = {
  corsProxyUrl?: string;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexRoute,
});

export const dataModelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/data-model",
  component: DataModelRoute,
});

export const classRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/class/$classIri",
  component: ClassRoute,
});

export const shapeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/shape/$shapeIri",
  component: ShapeRoute,
});

const routeTree = rootRoute.addChildren([indexRoute, dataModelRoute, classRoute, shapeRoute]);

const STORAGE_KEY_PREFIX = "shacl-manager:route:";

// localStorage can throw (privacy mode, sandboxed iframe with storage disabled, quota errors) -
// route persistence is a nice-to-have, so failures here are swallowed rather than surfaced.
function readPersistedPath(storageKey: string): string {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + storageKey) ?? "/";
  } catch {
    return "/";
  }
}

function persistPath(storageKey: string, path: string) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + storageKey, path);
  } catch {
    // best-effort only, see readPersistedPath
  }
}

// ShaclManager is embedded in a host page rather than owning it, so navigation between classes
// must not touch the host's own URL/history - a fresh in-memory history per instance keeps
// several embedded managers on one page (or inside Storybook) from stepping on each other.
// `storageKey` (typically the dataModelIRI) scopes route persistence the same way, so a hard
// refresh restores the route for that specific embedded instance rather than a random/last one.
export function createShaclManagerRouter(context: RouterContext, storageKey?: string) {
  const history = createMemoryHistory({
    initialEntries: [storageKey ? readPersistedPath(storageKey) : "/"],
  });

  if (storageKey) {
    history.subscribe(() => persistPath(storageKey, history.location.href));
  }

  return createRouter({
    routeTree,
    history,
    context,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createShaclManagerRouter>;
  }
}
