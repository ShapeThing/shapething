import type { NamedNode, Term } from "@rdfjs/types";
import { resolveRdfSource } from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import type { SortOrder } from "../sorting.ts";
import { inf, rdf, sh } from "../rdf/namespaces.ts";
import { compileRoles, pathsByRole, roleValue, targetClasses } from "./compile.ts";

/**
 * The display shapes of the app, one file per shape (plus the vocabulary, the groups and the
 * property shapes the modal shapes share), and the entity models (./models): what the data of a
 * person, a band or a programming language is. The display shapes of the columns and the search
 * take the paths of their name, picture, description and years from the roles of the entity models
 * (see compile.ts). They render what the queries (src/queries) give: Wikidata's own triples, plus
 * a few of the app's own (inf:influenceCount, inf:cover, the links) and schema:abstract.
 *
 * Every property declares its shui:viewer, so no widget scoring is needed. The custom viewers are
 * registered in src/widgets/index.ts.
 *
 * The stylesheets lay the shapes out by the names st:cssClass gives a property or a group, not by
 * the structure the renderer produces. The links of the app are in the data (src/queries):
 * st:href makes a name a link to inf:openHref, a portrait one to inf:aboutHref.
 *
 * Most values speak for themselves and have no label: an empty sh:name leaves the header of the
 * field empty, and the view mode hides an empty header. Only the item lists and the facts of the
 * modal (and the Wikipedia link) have a label. An empty sh:description keeps the help icon of
 * inf:influenceCount's rdfs:comment out of a header that has no label.
 */
const shapeFiles = import.meta.glob<string>(["./*.ttl", "./models/*.ttl"], {
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
compileRoles(shapesGraph);

/** The classes the shapes target: the queries type their items with them (rdf:type). */
export const modelClasses = targetClasses(shapesGraph);

const rolePaths = pathsByRole(shapesGraph);

/** The value of a role (shui:LabelRole, inf:StartRole…) of `focus` in `dataGraph` (compile.ts). */
export const valueOf = (dataGraph: RdfStore, focus: Term, role: NamedNode) =>
  roleValue(rolePaths, dataGraph, focus, role);

export const TeaserShape = inf("TeaserShape");
export const SearchResultsShape = inf("SearchResultsShape");

const SORT_SHAPE_NAMES = { influence: "Influence", name: "Name", born: "Born" } as const;

/**
 * A column of the ones that influenced the subject ("influencers") or that the subject influenced
 * ("influenced"), in a sort order (see ColumnShapes.ttl).
 */
export const columnShape = (direction: "influencers" | "influenced", order: SortOrder) =>
  inf(
    `${direction === "influenced" ? "Influenced" : "Influencers"}Column${SORT_SHAPE_NAMES[order]}`,
  );

export const PersonModalShape = inf("PersonModalShape");
const ConceptModalShape = inf("ConceptModalShape");
const MODAL_SHAPES = [PersonModalShape, inf("WorkModalShape")];

/**
 * The shape of an entity in the modal: the one that targets one of its classes (sh:targetClass, the
 * queries type it, see queries/entity.rq), else the shape of anything else.
 */
export const modalShapeFor = (dataGraph: RdfStore, focus: Term): NamedNode => {
  const types = dataGraph.getQuads(focus, rdf("type")).map((quad) => quad.object);
  return (
    MODAL_SHAPES.find((shape) =>
      shapesGraph
        .getQuads(shape, sh("targetClass"))
        .some((quad) => types.some((type) => type.equals(quad.object))),
    ) ?? ConceptModalShape
  );
};
