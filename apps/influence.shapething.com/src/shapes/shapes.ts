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
/** Every property of an entity, the second renderer of the modal (see data/resource.ts). */
export const AllPropertiesShape = inf("AllPropertiesShape");

/** The modal, by the kind of entity it shows: its side column and its text (see EntityModal). */
export const ModalShapes = {
  person: inf("PersonModalShape"),
  work: inf("WorkModalShape"),
  concept: inf("ConceptModalShape"),
} as const;
