import type { DatasetCore, Quad } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

export type RdfSource = RdfStore | URL | string | Quad[] | DatasetCore;
