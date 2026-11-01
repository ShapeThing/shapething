// Jargon used on the site. <Term id="…"> shows the description as a tooltip and links to /glossary#id.
export type GlossaryTerm = {
  term: string;
  description: string;
  link?: { label: string; href: string };
};

export const glossary = {
  "linked-data": {
    term: "Linked data",
    description:
      "A way of publishing data where every thing has its own web address, and things link to each other, just like web pages do.",
    link: { label: "W3C: Linked Data", href: "https://www.w3.org/wiki/LinkedData" },
  },
  rdf: {
    term: "RDF",
    description:
      'The data format behind linked data. All data is written as small statements of three parts, called triples, like "this recipe – has chef – Julia Child".',
    link: { label: "RDF 1.1 Primer", href: "https://www.w3.org/TR/rdf11-primer/" },
  },
  triple: {
    term: "Triple",
    description:
      "One RDF statement, made of a subject, a predicate and an object. Compare it to one cell in a table: the row, the column and the value.",
  },
  triplestore: {
    term: "Triplestore",
    description: "A database for RDF. It stores triples and answers SPARQL queries.",
  },
  iri: {
    term: "IRI",
    description:
      "The web address that identifies a thing in RDF, like https://example.org/chef/julia-child. It works like a primary key that is unique worldwide.",
  },
  resource: {
    term: "Resource",
    description:
      "Anything that is described in RDF, such as a recipe or a chef. On this site a resource together with all its data is also called a document.",
  },
  "blank-node": {
    term: "Blank node",
    description:
      "A thing in RDF without its own web address. It only exists as part of another resource, like the ingredient lines of a recipe. Comparable to a nested object in JSON.",
  },
  sparql: {
    term: "SPARQL",
    description: "The query language for RDF, comparable to SQL for relational databases.",
    link: { label: "SPARQL 1.1 Query Language", href: "https://www.w3.org/TR/sparql11-query/" },
  },
  shacl: {
    term: "SHACL",
    description:
      "The W3C standard for describing and validating RDF data. A SHACL file contains shapes.",
    link: { label: "SHACL specification", href: "https://www.w3.org/TR/shacl/" },
  },
  shape: {
    term: "Shape",
    description:
      "A description of what a resource should look like: which properties it has, of which type and how many. Comparable to a Zod or JSON Schema. ShapeThing uses shapes to fetch, show, edit, type and generate data.",
  },
  rdfjs: {
    term: "RDF/JS",
    description:
      "Shared JavaScript interfaces for RDF data and stores. Libraries that follow them, like the ones from ShapeThing, work together.",
    link: { label: "rdf.js.org", href: "https://rdf.js.org/" },
  },
} satisfies Record<string, GlossaryTerm>;

export type GlossaryId = keyof typeof glossary;
