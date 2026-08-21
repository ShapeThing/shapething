import namespace, { type NamespaceBuilder } from "@rdfjs/namespace";
import type { NamedNode } from "@rdfjs/types";
// Relative, not "@/" - this module is also imported (via a relative path) from the Storybook
// graph-inspector addon's manager-side Panel.tsx, whose esbuild bundle doesn't resolve path
// aliases the way the project's vite-built preview bundle does.
import { factory } from "./factory.ts";

/** RDFS namespace */
export const rdfs: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2000/01/rdf-schema#",
  {
    factory,
  },
);

/** RDF namespace */
export const rdf: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  { factory },
);

/** example.org namespace */
export const ex: NamespaceBuilder<string> = namespace("http://example.org/", {
  factory,
});

/** SHACL namespace */
export function sh<T extends string>(
  localName: T,
): NamedNode<`http://www.w3.org/ns/shacl#${T}`> {
  return factory.namedNode(`http://www.w3.org/ns/shacl#${localName}`);
}

/** SHACL UI namespace */
export const shui: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/ns/shacl-ui/",
  {
    factory,
  },
);

/** DASH namespace */
export const dash: NamespaceBuilder<string> = namespace(
  "http://datashapes.org/dash#",
  { factory },
);

/** XSD namespace */
export const xsd: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2001/XMLSchema#",
  {
    factory,
  },
);

/** OWL namespace */
export const owl: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2002/07/owl#",
  {
    factory,
  },
);

/** Faker.js namespace */
export const faker: NamespaceBuilder<string> = namespace(
  "https://fakerjs.dev/",
  { factory },
);

/** SKOS namespace */
export const skos: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2004/02/skos/core#",
  {
    factory,
  },
);

/** FOAF namespace */
export const foaf: NamespaceBuilder<string> = namespace(
  "http://xmlns.com/foaf/0.1/",
  { factory },
);

/** Dublin Core (elements) namespace */
export const dc: NamespaceBuilder<string> = namespace(
  "http://purl.org/dc/elements/1.1/",
  {
    factory,
  },
);

/** Dublin Core Terms namespace */
export const dcterms: NamespaceBuilder<string> = namespace(
  "http://purl.org/dc/terms/",
  {
    factory,
  },
);

/** DCAT namespace */
export const dcat: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/ns/dcat#",
  { factory },
);

/** schema.org namespace */
export const schema: NamespaceBuilder<string> = namespace(
  "http://schema.org/",
  { factory },
);

/** VoID namespace */
export const void_: NamespaceBuilder<string> = namespace(
  "http://rdfs.org/ns/void#",
  { factory },
);

/** PROV-O namespace */
export const prov: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/ns/prov#",
  { factory },
);

/** VANN namespace */
export const vann: NamespaceBuilder<string> = namespace(
  "http://purl.org/vocab/vann/",
  { factory },
);

/** RDF Data Cube namespace */
export const qb: NamespaceBuilder<string> = namespace(
  "http://purl.org/linked-data/cube#",
  {
    factory,
  },
);

/** OWL Time namespace */
export const time: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2006/time#",
  {
    factory,
  },
);

/** WGS84 Geo namespace */
export const geo: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2003/01/geo/wgs84_pos#",
  { factory },
);

/** ActivityStreams namespace */
export const as: NamespaceBuilder<string> = namespace(
  "https://www.w3.org/ns/activitystreams#",
  {
    factory,
  },
);

/** SW Vocab Status namespace */
export const vs: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2003/06/sw-vocab-status/ns#",
  { factory },
);

/** DBpedia ontology namespace */
export const dbo: NamespaceBuilder<string> = namespace(
  "http://dbpedia.org/ontology/",
  {
    factory,
  },
);

/** DBpedia resource namespace */
export const dbr: NamespaceBuilder<string> = namespace(
  "http://dbpedia.org/resource/",
  {
    factory,
  },
);

/** DBpedia property namespace */
export const dbp: NamespaceBuilder<string> = namespace(
  "http://dbpedia.org/property/",
  {
    factory,
  },
);

/** All prefixes used in Shapething, plus common vocabularies used by third-party data (e.g. for
 * best-effort turtle display in the Storybook graph-inspector/submit-preview addons) */
export const prefixes: Record<string, string> = Object.fromEntries(
  Object.entries({
    rdfs,
    rdf,
    ex,
    sh,
    dash,
    xsd,
    owl,
    faker,
    skos,
    shui,
    foaf,
    dc,
    dcterms,
    dcat,
    schema,
    void: void_,
    prov,
    vann,
    qb,
    time,
    geo,
    as,
    vs,
    dbo,
    dbr,
    dbp,
  }).map(([alias, namespace]) => [alias, namespace("").value]),
);

/** Prefixes as a SPARQL prefixes string */
export const queryPrefixes: string = Object.entries(prefixes)
  .map(([alias, iri]) => `prefix ${alias}: <${iri}>`)
  .join("\n");
