declare module "wkt" {
  import type { Feature, Geometry } from "geojson";

  export function parse(wkt: string): Geometry | null;
  // Accepts a Feature too - stringify() unwraps `.geometry` itself when given one.
  export function stringify(geometry: Feature | Geometry): string;
}
