import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import { LocalStore } from "@shapething/localstore";
import { DataFactory, Parser } from "n3";

const store = new LocalStore({ baseUri: new URL("https://example.org/") });

// Opens the folder picker of the browser. Chrome based browsers only:
// Firefox and Safari do not implement the File System Access API.
await store.mount();

// Every Turtle file in the folder is a graph, named after its path:
// chefs/julia-child.ttl is the graph <https://example.org/chefs/julia-child>.
const engine = new QueryEngine();
const bindings = await engine.queryBindings(
  `SELECT ?name WHERE {
    GRAPH ?g {
      ?chef <http://schema.org/name> ?name
    }
  }`,
  { sources: [store] },
);

// Writing a graph replaces its file, the prefixes are used in the Turtle.
const graph = DataFactory.namedNode("https://example.org/recipes/pancakes");
const quads = new Parser({ baseIRI: graph.value }).parse(turtle);
await store.replaceGraph(graph, quads, { schema: "http://schema.org/" });
