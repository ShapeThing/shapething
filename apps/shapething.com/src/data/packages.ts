import { examples } from "./examples";

type ExampleId = (typeof examples)[number]["id"];

// The published ShapeThing packages, shown on /packages and the homepage.
export type Package = {
  name: string;
  directory: string;
  summary: string;
  description: string;
  example: ExampleId;
};

export const packages: Package[] = [
  {
    name: "@shapething/shacl-renderer",
    directory: "shacl-renderer",
    example: "viewing-and-editing",
    summary: "React forms and views made from SHACL shapes.",
    description:
      "Give it a shapes graph and a data graph and it renders a form to edit, a view to read, or facets to filter, with live validation. It also generates TypeScript types and test data from your shapes. Implements SHACL 1.2 Core and the proposed SHACL-UI extension.",
  },
  {
    name: "@shapething/typed-sparql",
    directory: "typed-sparql",
    example: "fetching-a-list",
    summary: "TypeScript types for your SPARQL queries.",
    description:
      "A Vite plugin and a command line tool that read the SPARQL queries in your code and generate TypeScript types for their results, so your editor knows which variables a query returns.",
  },
  {
    name: "@shapething/resource-fetcher",
    directory: "resource-fetcher",
    example: "fetching-a-document",
    summary: "Fetch one complete resource, blank nodes and all.",
    description:
      "Retrieves all triples that belong to one IRI from a store or a SPARQL endpoint, including nested blank nodes. It builds on the Concise Bounded Description and can be guided by a SHACL shape.",
  },
  {
    name: "@shapething/textstore",
    directory: "text-store",
    example: "fuzzy-search",
    summary: "Fuzzy search on top of any RDF/JS store.",
    description:
      "Wraps an RDF/JS store, such as an N3 Store or a LocalStore, and adds in-memory fuzzy text search. You search with a special predicate, so it works with plain SPARQL.",
  },
  {
    name: "@shapething/localstore",
    directory: "local-store",
    example: "loading-data",
    summary: "A folder on your computer as a triplestore.",
    description:
      "An RDF/JS store that reads Turtle files from a folder and writes changes back to them, so you can query and update them with a SPARQL engine such as Comunica. Runs in Chrome.",
  },
];

export const exampleHref = (pkg: Package) => `/examples#${pkg.example}`;
