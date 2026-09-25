import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { geosparqlExtensionFunctions } from "@/helpers/geosparqlFunctions.ts";
import { getQueryEngine } from "@/helpers/queryEngine.ts";

function termToJson(term: Term): Record<string, string> {
  switch (term.termType) {
    case "NamedNode":
      return { type: "uri", value: term.value };
    case "BlankNode":
      return { type: "bnode", value: term.value };
    case "Literal":
      return term.language
        ? { type: "literal", value: term.value, "xml:lang": term.language }
        : { type: "literal", value: term.value, datatype: term.datatype.value };
    default:
      return { type: "literal", value: term.value };
  }
}

/**
 * A `fetch` that behaves like a SPARQL 1.1 Protocol endpoint serving `store` - every request's
 * query is answered by running it through Comunica against the local store, with GeoSPARQL
 * functions available the way a real GeoSPARQL-capable endpoint would have them. Lets tests run
 * the exact endpoint code path (Environment.facetsEndpoint: query text shipped over HTTP, SPARQL
 * JSON results parsed back) without a server. `requests` records every query text received.
 */
export function sparqlEndpointFetch(store: RdfStore): typeof fetch & { requests: string[] } {
  const requests: string[] = [];
  const endpointFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const body = init?.body ? new URLSearchParams(init.body.toString()) : undefined;
    const query = body?.get("query") ?? url.searchParams.get("query") ?? "";
    requests.push(query);

    const engine = await getQueryEngine();
    const result = await engine.query(query, {
      sources: [store],
      extensionFunctions: geosparqlExtensionFunctions,
    });
    if (result.resultType === "boolean") {
      return Response.json({ head: {}, boolean: await result.execute() });
    }
    if (result.resultType !== "bindings") throw new Error("shim only answers SELECT/ASK");

    const variables = (await result.metadata()).variables.map((variable) => variable.value);
    const bindings = await (await result.execute()).toArray();
    return new Response(
      JSON.stringify({
        head: { vars: variables },
        results: {
          bindings: bindings.map((binding) =>
            Object.fromEntries([...binding].map(([variable, term]) => [variable.value, termToJson(term)])),
          ),
        },
      }),
      { headers: { "content-type": "application/sparql-results+json" } },
    );
  };
  return Object.assign(endpointFetch as typeof fetch, { requests });
}
