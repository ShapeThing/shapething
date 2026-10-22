import type { StoryObj } from "@storybook/react-vite";
import type { NamedNode, Quad, Quad_Graph } from "@rdfjs/types";
import { dereferenceUrl } from "@shapething/shacl-renderer";
import { ShaclManager } from "../index.tsx";
import { factory } from "@/helpers/factory.ts";
import { CORS_PROXY_PATH } from "../../.storybook/corsProxy.ts";
import { owl, rdf } from "@/helpers/namespaces.ts";

// Each example's model.ttl names its imports by their real namespace IRIs, which don't all resolve
// live (skosapnl's 404s, for one) - the vendored, read-only copies under imports/ are served
// locally instead. Anything else loadGraph is asked for (e.g. skosapnl's own further owl:imports -
// skos, iso-thes, dct, foaf - all real, live-dereferenceable namespaces) falls through to a real
// fetch.
const localGraphs = new Map<string, URL>([
  [
    "https://data.norg.nl/def/begrippenkader#",
    new URL("../examples/nl-sbb-begrippenkader/model.ttl", import.meta.url),
  ],
  [
    "http://nlbegrip.nl/def/skosapnl#",
    new URL("../examples/nl-sbb-begrippenkader/imports/skosapnl.ttl", import.meta.url),
  ],
  [
    "https://data.norg.nl/def/opendata#",
    new URL("../examples/dcat-ap-nl-catalogus/model.ttl", import.meta.url),
  ],
  [
    "https://semiceu.github.io/DCAT-AP/releases/3.0.0/html/shacl/shapes.ttl",
    new URL("../examples/dcat-ap-nl-catalogus/imports/dcat-ap-eu-SHACL.ttl", import.meta.url),
  ],
  [
    "http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/",
    new URL("../examples/dcat-ap-nl-catalogus/imports/dcat-ap-nl-SHACL.ttl", import.meta.url),
  ],
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
  const url = localGraphs.get(graph.value) ?? proxiedUrl(graph.value);
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
  name: "Begrippenkader (NL-SBB)",
  args: {
    dataModelIRI: factory.namedNode("https://data.norg.nl/def/begrippenkader#"),
    loadGraph,
    // shacl-renderer's own corsProxyUrl fallback (Environment.corsProxyUrl) templates a target
    // in directly - `${corsProxyUrl}${encodeURIComponent(url)}` - unlike this story's own
    // proxiedUrl() helper above which spells out the `?url=` itself, so it must be included here.
    corsProxyUrl: `${CORS_PROXY_PATH}?url=`,
  },
};

// DCAT-AP-NL builds on the EU DCAT-AP baseline: many shapes, several targeting methods and blank
// node property shapes, so a good stress test for the overview and the split/merged rows.
export const DcatApNl: Story = {
  name: "Open data catalogue (DCAT-AP-NL)",
  args: {
    ...Default.args,
    dataModelIRI: factory.namedNode("https://data.norg.nl/def/opendata#"),
  },
};
