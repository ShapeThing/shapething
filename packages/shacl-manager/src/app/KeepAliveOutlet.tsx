import { Activity, createContext, use, useState, type ReactNode } from "react";
import { UNSAFE_RouteContext, useMatches, useOutlet } from "react-router";
import type { TabHandle } from "./route.tsx";

// How many pages each outlet keeps besides the one it shows. The least recently shown goes first.
const KEPT = 8;

// Whether the subtree is on screen: a hidden page's outlets keep showing what they showed, the
// router's matches are another page's by then.
const Shown = createContext(true);

type Page = { key: string; element: ReactNode; used: number };
type Kept = { active?: string; pages: Page[]; clock: number };

// An outlet whose pages stay mounted, hidden in an <Activity>, after you navigate away: coming
// back shows them as they were instead of rendering them again. Each page is the child route's
// match, so its own sub-routes (a tab, a list item, an edit dialog) are kept inside it.
// `outlet` is null when no child route matches, the kept pages are then all hidden.
export function useKeepAliveOutlet(): { outlet: ReactNode; kept: ReactNode } {
  const outlet = useOutlet();
  // This route's matches; the next one in the router's is the child route the outlet renders.
  const { matches } = use(UNSAFE_RouteContext);
  const child = useMatches()[matches.length];
  const shown = use(Shown);
  const [state, setState] = useState<Kept>({ pages: [], clock: 0 });

  // An edit or create form renders nothing of its own and isn't worth keeping.
  const keep = outlet !== null && !(child?.handle as TabHandle | undefined)?.hidden;
  const key = !shown ? state.active : keep ? child?.pathname : undefined;

  if (shown && key !== state.active) {
    const clock = state.clock + 1;
    let pages = state.pages;
    if (key !== undefined) {
      pages = pages.some((page) => page.key === key)
        ? pages.map((page) => (page.key === key ? { ...page, element: outlet, used: clock } : page))
        : [...pages, { key, element: outlet, used: clock }];
    }
    // In the order they were first shown, so React never moves their DOM around.
    while (pages.length > KEPT + 1) {
      const oldest = pages.reduce((a, b) => (b.key !== key && b.used < a.used ? b : a));
      pages = pages.filter((page) => page !== oldest);
    }
    setState({ active: key, pages, clock });
  }

  const kept = state.pages.map((page) => {
    const active = page.key === key;
    return (
      <Activity key={page.key} mode={active ? "visible" : "hidden"}>
        <Shown value={shown && active}>{active ? outlet : page.element}</Shown>
      </Activity>
    );
  });

  return { outlet, kept: keep || !outlet ? kept : [...kept, outlet] };
}

export function KeepAliveOutlet() {
  return useKeepAliveOutlet().kept;
}
