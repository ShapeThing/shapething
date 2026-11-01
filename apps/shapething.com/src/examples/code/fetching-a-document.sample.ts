import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import { ResourceFetcher } from "@shapething/resource-fetcher";
import { DataFactory, Parser, Store } from "n3";
import shapesTurtle from "./shapes.ttl?raw";

const engine = new QueryEngine();

// The fetcher only needs a way to run SELECT queries: a store, a SPARQL endpoint or anything else.
const queryBindings = async (query: string) =>
  (await engine.queryBindings(query, { sources: [store], unionDefaultGraph: true })).toArray();

// Basic: everything about the recipe, including its blank nodes such as the ingredients.
const recipe = new ResourceFetcher({
  resourceIri: DataFactory.namedNode("https://example.org/recipes/beef-wellington"),
  queryBindings,
});
const { results } = await recipe.execute();

// Advanced: a shape says what else belongs to the document, here the label of the cuisine of a chef.
const shapesGraph = new Store(new Parser().parse(shapesTurtle));

const chef = new ResourceFetcher({
  resourceIri: DataFactory.namedNode("https://example.org/chefs/julia-child"),
  queryBindings,
  shapesGraph,
  shapeIris: DataFactory.namedNode("http://example.org/ChefWithCuisineLabelShape"),
});
const { results: chefWithCuisine } = await chef.execute();
