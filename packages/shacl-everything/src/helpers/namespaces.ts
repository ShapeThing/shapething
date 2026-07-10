import namespace, { type NamespaceBuilder } from "@rdfjs/namespace";
import { factory } from "@/helpers/factory.ts";

/** RDFS namespace */
export const rdfs: NamespaceBuilder<string> = namespace("http://www.w3.org/2000/01/rdf-schema#", {
  factory,
});

/** RDF namespace */
export const rdf: NamespaceBuilder<string> = namespace(
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  { factory },
);

/** example.com namespace */
export const ex: NamespaceBuilder<string> = namespace("http://example.com/", {
  factory,
});

/** SHACL namespace */
export const sh: NamespaceBuilder<string> = namespace("http://www.w3.org/ns/shacl#", { factory });

/** SHACL UI namespace */
export const shui: NamespaceBuilder<string> = namespace("http://www.w3.org/ns/shacl-ui/", {
  factory,
});

/** DASH namespace */
export const dash: NamespaceBuilder<string> = namespace("http://datashapes.org/dash#", { factory });

/** XSD namespace */
export const xsd: NamespaceBuilder<string> = namespace("http://www.w3.org/2001/XMLSchema#", {
  factory,
});

/** OWL namespace */
export const owl: NamespaceBuilder<string> = namespace("http://www.w3.org/2002/07/owl#", {
  factory,
});

/** Faker.js namespace */
export const faker: NamespaceBuilder<string> = namespace("https://fakerjs.dev/", { factory });

/** SKOS namespace */
export const skos: NamespaceBuilder<string> = namespace("http://www.w3.org/2004/02/skos/core#", {
  factory,
});

/** All prefixes used in Shapething */
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
  }).map(([alias, namespace]) => [alias, namespace("").value]),
);

/** Prefixes as a SPARQL prefixes string */
export const queryPrefixes: string = Object.entries(prefixes)
  .map(([alias, iri]) => `prefix ${alias}: <${iri}>`)
  .join("\n");
