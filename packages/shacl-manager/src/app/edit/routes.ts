import type { RouteObject } from "react-router";

// The edit and create forms are routes of their own, so they can be linked to and survive a
// reload. They render nothing: the page above them shows its dialog while the URL is theirs.
export const EDIT = "edit";
export const NEW = "new";

export const editRoute: RouteObject = { path: EDIT, handle: { hidden: true } };

export const newRoute = (path: string = NEW): RouteObject => ({ path, handle: { hidden: true } });
