import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import type { TypedQuery } from "@shapething/typed-sparql";
import recipesQuery from "./recipes.rq";

const engine = new QueryEngine();

// The type of a row comes from the generated recipes.rq.d.ts.
const select = async <Row extends object>(query) => {
  const bindings = await (await engine.queryBindings(query, { sources: [store] })).toArray();
  return bindings.map(
    (binding) =>
      Object.fromEntries([...binding].map(([variable, term]) => [variable.value, term])) as Row,
  );
};

const recipes = await select(recipesQuery);

for (const recipe of recipes) {
  // chefName is optional in the query, so it can be undefined here.
  console.log(recipe.name.value, recipe.chefName?.value);
}
