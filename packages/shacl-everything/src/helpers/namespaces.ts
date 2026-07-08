import namespace, { type NamespaceBuilder } from "@rdfjs/namespace";
import { DataFactory } from "rdf-data-factory";

const factory = new DataFactory();

/** https://schema.org namespace */
export const schema: NamespaceBuilder<string> = namespace(
  "https://schema.org/",
  { factory },
);

/** http://schema.org namespace */
export const sdo: NamespaceBuilder<string> = namespace("http://schema.org/", {
  factory,
});

/** rdfs.org namespace */
export const rdfs: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2000/01/rdf-schema#",
  { factory },
);

/** Dublin Core namespace */
export const dce: NamespaceBuilder<string> = namespace(
  "http://purl.org/dc/elements/1.1/",
  { factory },
);

/** Dublin Core namespace */
export const dct: NamespaceBuilder<string> = namespace(
  "http://purl.org/dc/terms/1.1/",
  { factory },
);

/** rdf namespace */
export const rdf: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  { factory },
);

/** example.com namespace */
export const ex: NamespaceBuilder<string> = namespace("http://example.com/", {
  factory,
});

/** SHACL namespace */
export const sh: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/ns/shacl#",
  { factory },
);

/** DASH namespace */
export const dash: NamespaceBuilder<string> = namespace(
  "http://datashapes.org/dash#",
  { factory },
);

/** XSD namespace */
export const xsd: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2001/XMLSchema#",
  { factory },
);

/** Shapething SHACL renderer namespace */
export const stsr: NamespaceBuilder<string> = namespace(
  "http://ontology.shapething.com/shacl-renderer#",
  { factory },
);

/** Shapething facets namespace */
export const stf: NamespaceBuilder<string> = namespace(
  "http://ontology.shapething.com/facet#",
  { factory },
);

/** editor.js namespace */
export const ed: NamespaceBuilder<string> = namespace("https://editorjs.io/", {
  factory,
});

/** OWL namespace */
export const owl: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2002/07/owl#",
  { factory },
);

/** Faker.js namespace */
export const faker: NamespaceBuilder<string> = namespace(
  "https://fakerjs.dev/",
  { factory },
);

/** SKOS namespace */
export const skos: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/2004/02/skos/core#",
  { factory },
);

/** Local app namespace */
export const app: NamespaceBuilder<string> = namespace(
  ("http://example.com") + "/",
  { factory },
);

/** Genid */
export const genid: NamespaceBuilder<string> = namespace(
  "https://shacl-renderer.shapething.com/.well-known/genid/",
  { factory },
);

export const foaf: NamespaceBuilder<string> = namespace(
  "http://xmlns.com/foaf/0.1/",
  { factory },
);

export const dbo: NamespaceBuilder<string> = namespace(
  "http://dbpedia.org/ontology/",
  { factory },
);

export const og: NamespaceBuilder<string> = namespace("http://ogp.me/ns#", {
  factory,
});

export const geo: NamespaceBuilder<string> = namespace(
  "http://www.opengis.net/ont/geosparql#",
  { factory },
);

/** All prefixes used in Shapething */
export const prefixes: Record<string, string> = Object.fromEntries(
  Object.entries({
    schema,
    rdfs,
    rdf,
    ex,
    dce,
    dct,
    sh,
    dash,
    xsd,
    stsr,
    stf,
    ed,
    owl,
    faker,
    skos,
    app,
    foaf,
    dbo,
    og,
    geo,
  }).map(([alias, namespace]) => [alias, namespace("").value]),
);

/** Prefixes as a SPARQL prefixes string */
export const queryPrefixes: string = Object.entries(prefixes)
  .map(([alias, iri]) => `prefix ${alias}: <${iri}>`)
  .join("\n");
