declare module "wkt" {
  import type { Geometry } from "geojson";

  export function parse(wkt: string): Geometry | null;
  export function stringify(geometry: Geometry): string;
}
