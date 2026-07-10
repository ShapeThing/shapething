import type { DatasetCore, Quad } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

/**
 * Anything that can be turned into an RdfStore by a preprocessor.
 * `URL` is dereferenced over the network/filesystem; `string` is treated as
 * literal RDF text (Turtle), never as a URL to fetch — keeping the two
 * unambiguous instead of guessing from the string's shape.
 */
export type RdfSource = RdfStore | URL | string | Quad[] | DatasetCore;
