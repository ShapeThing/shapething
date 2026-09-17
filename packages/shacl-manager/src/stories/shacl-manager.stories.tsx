import type { StoryObj } from "@storybook/react-vite";
import type { NamedNode, Quad, Quad_Graph } from "@rdfjs/types";
import { dereferenceUrl } from "@shapething/shacl-everything";
import { ShaclManager } from "../index.tsx";
import { factory } from "@/helpers/factory.ts";
import { CORS_PROXY_PATH } from "../../.storybook/corsProxy.ts";
import { owl, rdf } from "@/helpers/namespaces.ts";

const modelUrl = new URL("../examples/nl-sbb-begrippenkader/model.ttl", import.meta.url);
const dataModelIRI = factory.namedNode("https://data.norg.nl/def/begrippenkader#");
const skosapnlUrl = new URL(
  "../examples/nl-sbb-begrippenkader/imports/skosapnl.ttl",
  import.meta.url,
);

// model.ttl's own owl:imports names skosapnl's real namespace IRI (http://nlbegrip.nl/def/
// skosapnl#), which doesn't currently resolve live (404) - imports/skosapnl.ttl is the vendored,
// read-only copy of that same content, so this story serves it locally instead of depending on
// that IRI actually being reachable. Anything else loadGraph is asked for (skosapnl's own further
// owl:imports - skos, iso-thes, dct, foaf - all real, live-dereferenceable namespaces) falls
// through to a real fetch.
const localGraphs = new Map<string, URL>([
  ["http://nlbegrip.nl/def/skosapnl#", skosapnlUrl],
  ["https://data.norg.nl/def/begrippenkader#", modelUrl],
]);
const quadCache = new Map<string, Promise<Quad[]>>();

// Routes every non-local graph through .storybook/corsProxy.ts's dev-server middleware up front,
// instead of dereferenceUrl's usual try-direct-then-fall-back-to-proxy order: skos/iso-thes/dct/foaf
// never send permissive CORS headers for a browser-origin request, so the direct attempt (and its
// own retries) would only ever waste time before failing anyway. A relative path resolves against
// the page's own origin - the middleware fetches the real target itself, in Node, where CORS
// doesn't apply, and hands the bytes back same-origin.
const proxiedUrl = (target: string): URL =>
  new URL(`${CORS_PROXY_PATH}?url=${encodeURIComponent(target)}`, import.meta.url);

const loadGraph = async (graph: NamedNode): Promise<Quad[]> => {
  console.log(`Loading graph for ${graph.value}`);
  const url = localGraphs.get(graph.value) ?? proxiedUrl(graph.value);
  console.log(`Dereferencing URL: ${url}`);
  const store = await dereferenceUrl(url, quadCache, undefined);
  const ontologyQuads = store.getQuads(undefined, rdf("type"), owl("Ontology"));
  const ontologyIri = ontologyQuads[0]?.subject;

  return store
    .getQuads()
    .map((quad) =>
      factory.quad(quad.subject, quad.predicate, quad.object, (ontologyIri as Quad_Graph) ?? graph),
    );
};

type Story = StoryObj<typeof ShaclManager>;

export default {
  title: "ShaclManager",
  component: ShaclManager,
};

export const Default: Story = {
  name: "Default",
  args: {
    dataModelIRI,
    loadGraph,
    // shacl-everything's own corsProxyUrl fallback (Environment.corsProxyUrl) templates a target
    // in directly - `${corsProxyUrl}${encodeURIComponent(url)}` - unlike this story's own
    // proxiedUrl() helper above which spells out the `?url=` itself, so it must be included here.
    corsProxyUrl: `${CORS_PROXY_PATH}?url=`,
  },
};
