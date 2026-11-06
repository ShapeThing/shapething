import type { Literal, NamedNode, Quad, Quad_Object } from "@rdfjs/types";
import { factory, inf, rdfs, schema, wdt, xsd } from "../rdf/namespaces.ts";
import type { EntityDetails, ItemLists, PersonSummary } from "./person.ts";

/**
 * The data graphs the display shapes (shapes/shapes.ttl) render. They hold the Wikidata triples
 * the queries matched, with Wikidata's own predicates, plus what Wikidata does not state itself:
 * the number of people someone influenced (inf:influenceCount) and the introduction of the
 * Wikipedia article (schema:abstract).
 *
 * Images (wdt:P18) are Wikidata's own links to the full Commons original; the display shapes'
 * st:imageWidth makes the renderer load a thumbnail instead.
 */

const quad = (subject: NamedNode, predicate: NamedNode, object: Quad_Object | undefined): Quad[] =>
  object ? [factory.quad(subject, predicate, object)] : [];

export const summaryQuads = (person: PersonSummary): Quad[] => [
  ...quad(person.iri, rdfs("label"), person.label),
  ...quad(person.iri, schema("description"), person.description),
  ...quad(person.iri, wdt("P18"), person.image),
  ...quad(person.iri, wdt("P569"), person.birthDate),
  ...quad(person.iri, wdt("P570"), person.deathDate),
  ...quad(
    person.iri,
    inf("influenceCount"),
    factory.literal(String(person.influence), xsd("integer")),
  ),
];

/** The works (P50 author, from the work), interests (P101) and ideas (P800) of a person. */
export const itemListQuads = (person: NamedNode, lists: ItemLists): Quad[] => [
  ...lists.works.flatMap((work) => [
    ...quad(work.iri, wdt("P50"), person),
    ...quad(work.iri, rdfs("label"), work.label),
    ...quad(work.iri, wdt("P577"), work.publicationDate),
  ]),
  ...lists.interests.flatMap((interest) => [
    ...quad(person, wdt("P101"), interest.iri),
    ...quad(interest.iri, rdfs("label"), interest.label),
  ]),
  ...lists.ideas.flatMap((idea) => [
    ...quad(person, wdt("P800"), idea.iri),
    ...quad(idea.iri, rdfs("label"), idea.label),
  ]),
];

export const entityQuads = (entity: EntityDetails, abstract: Literal | undefined): Quad[] => [
  // Which of these the modal shows is up to the shape of the entity's kind (EntityModal.tsx).
  ...summaryQuads(entity),
  ...quad(entity.iri, wdt("P577"), entity.publicationDate),
  ...(entity.article ? quad(entity.article, schema("about"), entity.iri) : []),
  ...quad(entity.iri, schema("abstract"), abstract),
];
