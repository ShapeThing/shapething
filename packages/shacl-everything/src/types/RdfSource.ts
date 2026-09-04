import type { DatasetCore, Quad } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

// A list is one or more sources to merge into a single store (e.g. several fixture files combined
// into one shapesGraph/dataGraph). Distinguished at runtime from a literal Quad[] source by
// inspecting the array's first element - see resolveRdfSources.ts's isQuad().
export type RdfSource = RdfStore | URL | string | Quad[] | DatasetCore | readonly RdfSource[];
