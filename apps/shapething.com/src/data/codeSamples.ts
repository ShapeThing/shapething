// The code behind each example on /examples, shown when the "Code" button in its heading is pressed.
// The samples are in src/examples/code, they are not type checked: they leave out the setup of the store and shapes.
import convertingAndGenerating from "../examples/code/converting-and-generating.sample.ts?raw";
import fetchingADocument from "../examples/code/fetching-a-document.sample.ts?raw";
import fetchingAList from "../examples/code/fetching-a-list.sample.ts?raw";
import viteConfig from "../examples/code/fetching-a-list.vite.config.sample.ts?raw";
import fuzzySearch from "../examples/code/fuzzy-search.sample.ts?raw";
import loadingData from "../examples/code/loading-data.sample.ts?raw";
import viewingAndEditing from "../examples/code/viewing-and-editing.sample.tsx?raw";
import chefShape from "../examples/chef-with-cuisine-label.ttl?raw";
import recipesQuery from "../examples/recipes.rq?raw";
import shapes from "../examples/shapes.ttl?raw";
import type { examples } from "./examples";

export type CodeSample = {
  file: string;
  language: "ts" | "tsx" | "sparql" | "turtle";
  code: string;
};

export const codeSamples: Record<(typeof examples)[number]["id"], CodeSample[]> = {
  "loading-data": [{ file: "store.ts", language: "ts", code: loadingData }],
  "fetching-a-list": [
    { file: "vite.config.ts", language: "ts", code: viteConfig },
    { file: "recipes.rq", language: "sparql", code: recipesQuery },
    { file: "recipes.ts", language: "ts", code: fetchingAList },
  ],
  "fuzzy-search": [{ file: "search.ts", language: "ts", code: fuzzySearch }],
  "fetching-a-document": [
    { file: "fetch.ts", language: "ts", code: fetchingADocument },
    { file: "shapes.ttl", language: "turtle", code: chefShape },
  ],
  "viewing-and-editing": [
    { file: "Recipe.tsx", language: "tsx", code: viewingAndEditing },
    { file: "shapes.ttl", language: "turtle", code: shapes },
  ],
  "converting-and-generating": [
    { file: "tools.ts", language: "ts", code: convertingAndGenerating },
  ],
};
