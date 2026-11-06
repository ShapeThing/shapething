import type { Literal, NamedNode, Quad, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { ResourceFetcher } from "@shapething/resource-fetcher";
import { factory, inf, rdf, rdfs, sh, shui, st, wdt, xsd } from "../rdf/namespaces.ts";
import { queryBindings } from "../sparql/select.ts";
import { entityId } from "./entities.ts";

/** A row of queries/resourceLabels.rq. */
export type ResourceLabelRow = {
  term: NamedNode;
  name?: Literal;
  mulName?: Literal;
  // Only the rows of properties have one, which typed-sparql cannot tell from the UNION.
  propertyType?: Term;
};

/**
 * Everything Wikidata states about one entity, fetched with the resource fetcher. The query service
 * has no named graphs, and fetching ahead only for blank nodes keeps the queries small: otherwise
 * the triples of every value would come along (all of wd:Q5 "human" for every person).
 */
export const fetchResource = async (iri: NamedNode): Promise<Quad[]> => {
  const fetcher = new ResourceFetcher({
    resourceIri: iri,
    queryBindings,
    useNamedGraphs: false,
    overfetch: "blankNodes",
  });
  const { results } = await fetcher.execute();
  return results;
};

const WDT = wdt("").value;
const ENTITY = "http://www.wikidata.org/entity/";
// "Unknown value" (somevalue) in the truthy statements: there is nothing to show for it.
const GENID = "http://www.wikidata.org/.well-known/genid/";
const EXTERNAL_ID = "http://wikiba.se/ontology#ExternalId";
const TIME = "http://wikiba.se/ontology#Time";
const COMMONS_MEDIA = "http://wikiba.se/ontology#CommonsMedia";
// Commons media can be sound, video or a document too: only pictures are shown as an image.
const PICTURE = /\.(jpe?g|png|gif|svg|tiff?|webp)$/i;

const nameOf = (row: ResourceLabelRow | undefined) => row?.name ?? row?.mulName;

/**
 * The second renderer of the modal: every property (wdt: predicate) of the entity with every
 * value, under inf:AllPropertiesShape (shapes.ttl). The property shapes are made here, one for
 * each property the entity has, named after the property and sorted by that name, the external
 * identifiers in a group of their own. The viewer follows from the values: items are shown by
 * their name as a link (which opens them in the modal), pictures from Commons as an image, other
 * IRIs as a link and dates as a year.
 */
export const allPropertiesGraphs = (
  iri: NamedNode,
  resource: readonly Quad[],
  labelRows: readonly ResourceLabelRow[],
  /** The predicates shown elsewhere in the modal (see shownPredicates), left out here. */
  shown: ReadonlySet<string> = new Set(),
): { shapes: Quad[]; data: Quad[] } => {
  const labels = new Map(labelRows.map((row) => [row.term.value, row]));

  const values = new Map<string, Term[]>();
  for (const quad of resource) {
    if (!quad.subject.equals(iri) || !quad.predicate.value.startsWith(WDT)) continue;
    if (shown.has(quad.predicate.value)) continue;
    if (quad.object.value.startsWith(GENID)) continue;
    const list = values.get(quad.predicate.value) ?? [];
    list.push(quad.object);
    values.set(quad.predicate.value, list);
  }

  const properties = [...values.keys()]
    .map((predicate) => {
      const row = labels.get(predicate);
      return { predicate, row, name: nameOf(row)?.value ?? predicate.slice(WDT.length) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const shapes: Quad[] = [];
  const data: Quad[] = [];
  const add = (target: Quad[], ...[subject, predicate, object]: Parameters<typeof factory.quad>) =>
    target.push(factory.quad(subject, predicate, object));

  properties.forEach(({ predicate, row, name }, order) => {
    const path = factory.namedNode(predicate);
    const terms = values.get(predicate) ?? [];
    const property = factory.blankNode();

    add(shapes, inf("AllPropertiesShape"), sh("property"), property);
    add(shapes, property, sh("path"), path);
    add(shapes, property, sh("name"), factory.literal(name, "en"));
    add(shapes, property, sh("order"), factory.literal(String(order), xsd("integer")));
    add(
      shapes,
      property,
      sh("group"),
      row?.propertyType?.value === EXTERNAL_ID ? inf("identifiers") : inf("statements"),
    );

    const isItem = (term: Term) => term.termType === "NamedNode" && term.value.startsWith(ENTITY);
    if (
      row?.propertyType?.value === COMMONS_MEDIA &&
      terms.every((term) => term.termType === "NamedNode" && PICTURE.test(term.value))
    ) {
      add(shapes, property, shui("viewer"), shui("ImageViewer"));
      // Shown at 100px at most (EntityModal/style.scss), a Commons thumbnail at twice that.
      add(shapes, property, st("imageWidth"), factory.literal("200", xsd("integer")));
    } else if (terms.every(isItem)) {
      add(shapes, property, shui("viewer"), shui("LabelViewer"));
      add(shapes, property, sh("node"), inf("ItemShape"));
    } else if (terms.every((term) => term.termType === "NamedNode")) {
      add(shapes, property, shui("viewer"), shui("HyperlinkViewer"));
    } else if (row?.propertyType?.value === TIME) {
      add(shapes, property, shui("viewer"), inf("YearViewer"));
    } else {
      add(shapes, property, shui("viewer"), shui("LiteralViewer"));
    }

    for (const term of terms) {
      add(data, iri, path, term as Quad["object"]);
      if (!isItem(term)) continue;
      // An item without an English or "mul" name is shown by its identifier.
      const label = nameOf(labels.get(term.value));
      add(
        data,
        term as NamedNode,
        rdfs("label"),
        label ?? factory.literal(entityId(term as NamedNode) ?? ""),
      );
    }
  });

  if (properties.length === 0) add(shapes, inf("AllPropertiesShape"), rdf("type"), sh("NodeShape"));

  return { shapes, data };
};

/**
 * The predicates the given node shapes show of their focus node: the first step of each property's
 * sh:path, a predicate or the first of a sequence path (wdt:P27 of ( wdt:P27 wdt:P41 )). An inverse
 * or alternative path is not a statement of the focus node, so it is not counted. The list of all
 * properties leaves these out, so nothing in the side column or the text is shown twice.
 */
export const shownPredicates = (
  shapesGraph: RdfStore,
  nodeShapes: readonly NamedNode[],
): Set<string> => {
  const shown = new Set<string>();
  for (const nodeShape of nodeShapes) {
    for (const { object: property } of shapesGraph.getQuads(nodeShape, sh("property"))) {
      const path = shapesGraph.getQuads(property as NamedNode, sh("path"))[0]?.object;
      if (path?.termType === "NamedNode") shown.add(path.value);
      else if (path?.termType === "BlankNode") {
        const first = shapesGraph.getQuads(path, rdf("first"))[0]?.object;
        if (first?.termType === "NamedNode") shown.add(first.value);
      }
    }
  }
  return shown;
};
