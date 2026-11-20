import { type ComponentType, Suspense } from "react";
import { NavLink, Outlet, useParams, type RouteObject } from "react-router";
import { SubjectHeading, type HeadingActions } from "./SubjectHeading.tsx";
import { useTermParam } from "./useTermParam.ts";

// A sub-route's tab: its label, a number next to it (a component that may suspend while it loads),
// or no tab at all (an edit or create form's route).
export type TabHandle = { label?: string; Count?: ComponentType; hidden?: boolean };

type Tab = { path: string; label: string; Count?: ComponentType };

// A layout route: its title, tabs for its static sub-routes, and the active one below. A path
// ending in a parameter (class/:class) shows its value next to the title.
// `actions`: what the subject's header offers, see HeadingActions.
export function route(
  path: string,
  title: string,
  children: RouteObject[],
  { actions = {} }: { actions?: HeadingActions } = {},
): RouteObject {
  const tabs = children.flatMap((child): Tab[] => {
    const handle = child.handle as TabHandle | undefined;
    return child.path && !child.path.includes(":") && !handle?.hidden
      ? [{ path: child.path, label: handle?.label ?? child.path, Count: handle?.Count }]
      : [];
  });
  const param = path.match(/:(\w+)$/)?.[1];
  const element = <Section title={title} param={param} tabs={tabs} actions={actions} />;
  return { path, element, children };
}

type SectionProps = { title: string; param?: string; tabs: Tab[]; actions: HeadingActions };

function Section({ title, param, tabs, actions }: SectionProps) {
  const params = useParams();
  const value = param ? params[param] : undefined;

  return (
    <section className="st-section">
      {param ? <SubjectHeader param={param} title={title} actions={actions} /> : <h2>{title}</h2>}
      {tabs.length > 0 && (
        <nav className="st-section__tabs">
          {tabs.map(({ path, label, Count }) => (
            <NavLink key={path} to={path}>
              {label}
              {Count && (
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

// A subject's header: the classes it is an instance of as chips, its label, and its IRI below.
function SubjectHeader({
  param,
  title,
  actions,
}: {
  param: string;
  title: string;
  actions: HeadingActions;
}) {
  const term = useTermParam(param);
  if (!term) return <h2>{title}</h2>;
  return <SubjectHeading term={term} fallbacks={{ type: title }} actions={actions} />;
}
