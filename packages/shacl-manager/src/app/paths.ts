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

// Outside of a perspective and origin, such as on the data model's page, the defaults.
function usePlace() {
  const params = useMatch("/:perspective/:origin/*")?.params;
  const inPlace = isPerspective(params?.perspective) && isOrigin(params?.origin);
  return {
    perspective: inPlace ? (params!.perspective as Perspective) : "shapes",
    origin: inPlace ? (params!.origin as Origin) : "managed",
  };
}

export const usePerspective = (): Perspective => usePlace().perspective;
export const useOrigin = (): Origin => usePlace().origin;
