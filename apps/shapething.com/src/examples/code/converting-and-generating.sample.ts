import { generate, rdfToJs, shaclToType } from "@shapething/shacl-renderer/tools";
import { DataFactory, Store } from "n3";

const { namedNode } = DataFactory;
const RecipeShape = namedNode("http://example.org/RecipeShape");
const ChefShape = namedNode("http://example.org/ChefShape");

// Converting: a TypeScript type per shape, as source code.
const types = shaclToType({ shapesGraph, nodeShapes: [RecipeShape, ChefShape] });
const recipeType = types.get("RecipeShape");

// Converting: RDF to a plain JavaScript object, with English values only.
const recipe = await rdfToJs({
  shapesGraph,
  dataGraph,
  focusNode: namedNode("https://example.org/recipes/beef-wellington"),
  nodeShapes: [RecipeShape],
  languages: ["en"],
});

// Generating: fake data that follows the shape, written into the data graph.
// Existing chefs in the data graph can be picked as the chef of the recipe.
const generated = new Store(chefs);
await generate({
  shapesGraph,
  dataGraph: generated,
  focusNode: namedNode("https://example.org/recipes/generated"),
  nodeShapes: [RecipeShape],
});
