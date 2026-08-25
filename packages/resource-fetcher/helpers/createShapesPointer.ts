import dataFactory from "@rdfjs/data-model";
import type { DatasetCore, Term } from "@rdfjs/types";
import grapoi from "grapoi";
import type Grapoi from "./Grapoi.ts";

// grapoi is an internal implementation detail of shape-guided fetching - ResourceFetcher's own
// constructor builds the pointer through this from a plain shapesGraph + shapeIris pair, so
// callers never need their own dependency on grapoi just to drive shape-guided fetching.
export function createShapesPointer(shapesGraph: DatasetCore, shapeIris: Term | Term[]): Grapoi {
  return grapoi({
    dataset: shapesGraph,
    factory: dataFactory,
    terms: Array.isArray(shapeIris) ? shapeIris : [shapeIris],
  });
}
