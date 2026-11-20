import { useMatch } from "react-router";

export const perspectives = [
  { path: "shapes", label: "Shapes" },
  { path: "knowledge", label: "Knowledge" },
] as const;

export const origins = [
  { path: "managed", label: "Managed" },
  { path: "imported", label: "Imported" },
] as const;

export type Perspective = (typeof perspectives)[number]["path"];
export type Origin = (typeof origins)[number]["path"];
export type SubjectKind = "shape" | "class" | "group";

export const originPath = (perspective: Perspective, origin: Origin) => `/${perspective}/${origin}`;

export const subjectPath = (origin: Origin, kind: SubjectKind, segment: string) =>
  `/shapes/${origin}/${kind}/${segment}`;

export const classPath = (origin: Origin, segment: string) => `/knowledge/${origin}/${segment}`;

const isPerspective = (path?: string): path is Perspective =>
  perspectives.some((tab) => tab.path === path);
const isOrigin = (path?: string): path is Origin => origins.some((tab) => tab.path === path);

// The perspective and origin in the route, undefined outside of them, such as on the data model's page.
export function usePlace(): { perspective: Perspective; origin: Origin } | undefined {
  const params = useMatch("/:perspective/:origin/*")?.params;
  if (!isPerspective(params?.perspective) || !isOrigin(params?.origin)) return undefined;
  return { perspective: params.perspective, origin: params.origin };
}

// Outside of a perspective and origin, the defaults.
export const usePerspective = (): Perspective => usePlace()?.perspective ?? "shapes";
export const useOrigin = (): Origin => usePlace()?.origin ?? "managed";
