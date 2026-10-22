import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import Layout from "@/app/Layout.tsx";
import Overview from "@/views/overview/Overview.tsx";
import FocusView from "@/views/focus/FocusView.tsx";

export type RouterContext = {
  corsProxyUrl?: string;
};

/**
 * `?property=` opens a property in the panel, `?edit=<key>` the form of that shape or class, and
 * `?hidden=` lists the node shapes deselected in the hierarchy (all are selected by default).
 */
export type FocusSearch = { property?: string; edit?: string; hidden?: string[] };

const validateFocusSearch = (search: Record<string, unknown>): FocusSearch => ({
  property: typeof search.property === "string" ? search.property : undefined,
  edit: typeof search.edit === "string" ? search.edit : undefined,
  hidden:
    Array.isArray(search.hidden) && search.hidden.length
      ? search.hidden.filter((key): key is string => typeof key === "string")
      : undefined,
});

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

export const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Overview,
});

// Param values are termKey()s (see helpers/iri.ts), so blank node shapes are reachable too.
export const shapeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/shape/$shape",
  validateSearch: validateFocusSearch,
  component: () => {
    const { shape } = shapeRoute.useParams();
    return <FocusView kind="shape" focusKey={decodeURIComponent(shape)} />;
  },
});

export const classRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/class/$class",
  validateSearch: validateFocusSearch,
  component: () => {
    const { class: owlClass } = classRoute.useParams();
    return <FocusView kind="class" focusKey={decodeURIComponent(owlClass)} />;
  },
});

const routeTree = rootRoute.addChildren([overviewRoute, shapeRoute, classRoute]);

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
    // A persisted route from before this restructure (e.g. /data-model) lands on the overview.
    defaultNotFoundComponent: Overview,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createShaclManagerRouter>;
  }
}
