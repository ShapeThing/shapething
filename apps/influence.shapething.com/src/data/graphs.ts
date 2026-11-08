import type { Literal, NamedNode, Quad, Quad_Object } from "@rdfjs/types";
import { factory, inf, rdfs, schema, wdt, xsd } from "../rdf/namespaces.ts";
import type { EntityDetails, ItemLists, ListItem, PersonSummary } from "./person.ts";

/**
 * The data graphs the display shapes (src/shapes) render. They hold the Wikidata triples
 * the queries matched, with Wikidata's own predicates, plus what Wikidata does not state itself:
 * the number of people someone influenced (inf:influenceCount) and the introduction of the
 * Wikipedia article (schema:abstract).
 *
 * Images (wdt:P18) are Wikidata's own links to the full Commons original; the display shapes'
 * st:imageWidth makes the renderer load a thumbnail instead. A work without one has the Open Library
 * cover there instead, when there is one (see data/openLibrary.ts).
 *
 * The links of the app are in the data too, for the display shapes' st:href: where a person leads
 * (inf:openHref, starting a chain with them) and where more about them is (inf:aboutHref, the
 * modal). A column points the first one at its own path instead (see PersonRow).
 */

const quad = (subject: NamedNode, predicate: NamedNode, object: Quad_Object | undefined): Quad[] =>
  object ? [factory.quad(subject, predicate, object)] : [];

export const summaryQuads = (person: PersonSummary): Quad[] => [
  ...quad(person.iri, rdfs("label"), person.label),
  ...quad(person.iri, inf("openHref"), factory.literal(`/${person.id}`)),
  ...quad(person.iri, inf("aboutHref"), factory.literal(`#${person.id}`)),
  ...quad(person.iri, schema("description"), person.description),
  ...quad(person.iri, wdt("P18"), person.image),
  ...quad(person.iri, wdt("P569"), person.birthDate),
  ...quad(person.iri, wdt("P570"), person.deathDate),
  // A band's: when it was formed and when it broke up.
  ...quad(person.iri, wdt("P571"), person.inception),
  ...quad(person.iri, wdt("P576"), person.dissolved),
  ...quad(
    person.iri,
    inf("influenceCount"),
    factory.literal(String(person.influence), xsd("integer")),
  ),
];

/**
 * The birth and the death of a person (the forming and the breaking up of a band) as events with a date (P585, point in time), so they take
 * their place among the works on the timeline of the modal (inf:PersonWorksShape): a work published
 * after the death comes after it.
 */
export const lifeEventQuads = (person: PersonSummary): Quad[] =>
  (
    [
      ["born", "Born", person.birthDate],
      ["died", "Died", person.deathDate],
      // A band's.
      ["formed", "Formed", person.inception],
      ["disbanded", "Disbanded", person.dissolved],
    ] as const
  ).flatMap(([key, label, date]) => {
    if (!date) return [];
    const event = inf(`${key}-${person.id}`);
    return [
      factory.quad(person.iri, inf("lifeEvent"), event),
      factory.quad(event, inf("eventLabel"), factory.literal(label, "en")),
      factory.quad(event, wdt("P585"), date),
    ];
  });

/** The image and the short description of an item in the lists: for the cards of the modal. */
const itemQuads = (item: ListItem): Quad[] => [
  ...quad(item.iri, rdfs("label"), item.label),
  ...quad(item.iri, schema("description"), item.description),
  ...quad(item.iri, wdt("P18"), item.image),
];

/**
 * What a person made: works (P50 author), albums (P175 performer) and artworks (P170 creator), each
 * from the item; and their interests (P101) and ideas (P800).
 */
export const itemListQuads = (person: NamedNode, lists: ItemLists): Quad[] => [
  ...lists.works.flatMap((work) => [
    ...quad(work.iri, wdt("P50"), person),
    ...itemQuads(work),
    // The works are listed by the year they were made, or else published (inf:PersonWorksShape).
    ...quad(work.iri, wdt("P571"), work.inception),
    ...quad(work.iri, wdt("P577"), work.publicationDate),
  ]),
  // The albums, by the date they were released.
  ...lists.albums.flatMap((album) => [
    ...quad(album.iri, wdt("P175"), person),
    ...itemQuads(album),
    ...quad(album.iri, wdt("P577"), album.publicationDate),
  ]),
  // The artworks, by the year they were made.
  ...lists.artworks.flatMap((artwork) => [
    ...quad(artwork.iri, wdt("P170"), person),
    ...itemQuads(artwork),
    ...quad(artwork.iri, wdt("P571"), artwork.inception),
  ]),
  ...lists.interests.flatMap((interest) => [
    ...quad(person, wdt("P101"), interest.iri),
    ...itemQuads(interest),
  ]),
  ...lists.ideas.flatMap((idea) => [...quad(person, wdt("P800"), idea.iri), ...itemQuads(idea)]),
];

export const entityQuads = (entity: EntityDetails, abstract: Literal | undefined): Quad[] => [
  // Which of these the modal shows is up to the shape of the entity's kind (EntityModal.tsx).
  ...summaryQuads(entity),
  ...quad(entity.iri, wdt("P577"), entity.publicationDate),
  // The name in the side column of the modal: the full name, or else the name itself.
  ...quad(entity.iri, inf("fullName"), entity.fullName ?? entity.label),
  // The countries of citizenship with their names and flags. The flag is named after its country
  // too: that is its alternative text.
  ...entity.citizenships.flatMap((citizenship) => [
    ...quad(entity.iri, wdt("P27"), citizenship.iri),
    ...quad(citizenship.iri, rdfs("label"), citizenship.name),
    ...quad(citizenship.iri, wdt("P41"), citizenship.flag),
    ...quad(citizenship.iri, wdt("P1549"), citizenship.demonym),
    ...quad(citizenship.flag, rdfs("label"), citizenship.name),
  ]),
  // The occupations with their names, shown as links (inf:ItemShape).
  ...entity.occupations.flatMap((occupation) => [
    ...quad(entity.iri, wdt("P106"), occupation.iri),
    ...quad(occupation.iri, rdfs("label"), occupation.name),
  ]),
  // The place of birth with its name and coordinates: the map of inf:PersonModalShape.
  ...(entity.birthPlace
    ? [
        ...quad(entity.iri, wdt("P19"), entity.birthPlace.iri),
        ...quad(entity.birthPlace.iri, rdfs("label"), entity.birthPlace.name),
        ...quad(entity.birthPlace.iri, wdt("P625"), entity.birthPlace.location),
      ]
    : []),
  ...(entity.article ? quad(entity.article, schema("about"), entity.iri) : []),
  ...quad(entity.iri, schema("abstract"), abstract),
];
