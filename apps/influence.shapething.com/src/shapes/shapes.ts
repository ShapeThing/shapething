import { resolveRdfSource } from "@shapething/shacl-renderer";
import { inf } from "../rdf/namespaces.ts";
import shapesTurtle from "./shapes.ttl?raw";

/**
 * The shapes graph, parsed once and shared by every renderer (each renderer copies it, it is
 * never changed).
 */
export const shapesGraph = await resolveRdfSource(shapesTurtle, new Map(), undefined);

export const ColumnShape = inf("ColumnShape");
export const TeaserShape = inf("TeaserShape");

/** The shape of the modal, by the kind of entity it shows. */
export const ModalShapes = {
  person: inf("PersonModalShape"),
  work: inf("WorkModalShape"),
  concept: inf("ConceptModalShape"),
} as const;
