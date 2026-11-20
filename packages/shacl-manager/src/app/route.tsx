import { type ComponentType, Suspense } from "react";
import { NavLink, Outlet, useParams, type RouteObject } from "react-router";

// A sub-route can show a number next to its link by giving `handle: { Count }`: a component that
// renders that number, and may suspend while it loads.
export type TabHandle = { Count?: ComponentType };

type Link = { path: string; Count?: ComponentType };

// A layout route: shows its title, links to its static sub-routes and renders the active one below.
// A path with a parameter (class/:class) shows that parameter's value next to the title.
export function route(path: string, title: string, children: RouteObject[]): RouteObject {
  const links = children.flatMap((child): Link[] =>
    child.path && !child.path.includes(":")
      ? [{ path: child.path, Count: (child.handle as TabHandle | undefined)?.Count }]
      : [],
  );
  const param = path.match(/:(\w+)$/)?.[1];
  return { path, element: <Section title={title} param={param} links={links} />, children };
}

function Section({ title, param, links }: { title: string; param?: string; links: Link[] }) {
  const params = useParams();
  const value = param ? params[param] : undefined;
  const heading = value ? `${title}: ${value}` : title;

  return (
    <section className="st-section">
      <h2>{heading}</h2>
      {links.length > 0 && (
        <nav>
          {links.map(({ path, Count }) => (
            <NavLink key={path} to={path}>
              {path}
              {Count && (
                // Blank until loaded; keyed by the route value so a stale number never shows.
                <Suspense key={value} fallback={null}>
                  {" "}
                  <span className="st-manager__tab-count">
                    <Count />
                  </span>
                </Suspense>
              )}
            </NavLink>
          ))}
        </nav>
      )}
      <Outlet />
    </section>
  );
}
