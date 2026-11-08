import { resolveRdfSource } from "@shapething/shacl-renderer";
import { inf } from "../rdf/namespaces.ts";

/**
 * The display shapes of the app, one file per shape (plus the vocabulary, the groups and the
 * property shapes the modal shapes share). They render the data graphs of src/data/graphs.ts:
 * Wikidata triples with Wikidata's own predicates, plus inf:influenceCount and schema:abstract.
 *
 * Every property declares its shui:viewer, so no widget scoring is needed. The custom viewers are
 * registered in src/widgets/index.ts.
 *
 * The stylesheets lay the shapes out by the names st:cssClass gives a property or a group, not by
 * the structure the renderer produces. The links of the app are in the data (src/data/graphs.ts):
 * st:href makes a name a link to inf:openHref, a portrait one to inf:aboutHref.
 *
 * Most values speak for themselves and have no label: an empty sh:name leaves the header of the
 * field empty, and the view mode hides an empty header. Only the item lists and the facts of the
 * modal (and the Wikipedia link) have a label. An empty sh:description keeps the help icon of
 * inf:influenceCount's rdfs:comment out of a header that has no label.
 */
const shapeFiles = import.meta.glob<string>("./*.ttl", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The shapes graph, parsed once and shared by every renderer (each renderer copies it, it is
 * never changed). The files are joined into one Turtle text, so they share one parse.
 */
export const shapesGraph = await resolveRdfSource(
  Object.values(shapeFiles).join("\n"),
  new Map(),
  undefined,
);

export const ColumnShape = inf("ColumnShape");
export const TeaserShape = inf("TeaserShape");
/** Every property of an entity, the second renderer of the modal (see queries/allProperties.rq). */
export const AllPropertiesShape = inf("AllPropertiesShape");

/** The tabs of a person's modal beside "About", by list (see EntityLists). */
export const PersonListShapes = {
  works: inf("PersonWorksShape"),
  ideas: inf("PersonIdeasShape"),
  interests: inf("PersonInterestsShape"),
} as const;

/** The modal, by the kind of entity it shows: its side column and its text (see EntityModal). */
export const ModalShapes = {
  person: inf("PersonModalShape"),
  work: inf("WorkModalShape"),
  concept: inf("ConceptModalShape"),
} as const;
