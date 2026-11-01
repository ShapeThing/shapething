import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import { TextStore } from "@shapething/textstore";
import { Charset, Encoder } from "flexsearch";

// Wraps any RDF/JS store, such as an N3 Store or a LocalStore.
const textStore = new TextStore({
  store,
  // Optional, Flexsearch options. This encoder allows typos such as "welington".
  indexOptions: {
    tokenize: "forward",
    encoder: new Encoder(Charset.LatinAdvanced, { minlength: 3 }),
  },
});

// Searching is a normal triple pattern with tsst:search as predicate.
// All other patterns are answered by the wrapped store.
const engine = new QueryEngine();
const bindings = await engine.queryBindings(
  `PREFIX schema: <http://schema.org/>
  PREFIX tsst: <https://textstore.shapething.com/>

  SELECT DISTINCT ?resource ?name WHERE {
    GRAPH ?resource {
      ?match tsst:search "welington" .
      ?resource schema:name ?name .
    }
  }`,
  { sources: [textStore] },
);
