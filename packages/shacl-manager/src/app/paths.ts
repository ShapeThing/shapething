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

function usePlace() {
  const params = useMatch("/:perspective/:origin/*")?.params;
  return {
    perspective: (params?.perspective ?? "shapes") as Perspective,
    origin: (params?.origin ?? "managed") as Origin,
  };
}

export const usePerspective = (): Perspective => usePlace().perspective;
export const useOrigin = (): Origin => usePlace().origin;
