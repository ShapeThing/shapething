import type { StoryObj } from "@storybook/react-vite";
import type { NamedNode, Quad } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { fn } from "storybook/test";
import { dereferenceUrl } from "@shapething/shacl-renderer";
import { ShaclManager, type LoadGraph } from "../index.tsx";
import { CORS_PROXY_PATH } from "../../.storybook/corsProxy.ts";

const factory = new DataFactory();

// The example models and their vendored imports are named by their real IRIs, which don't resolve
// live - the copies under examples/ are served by Storybook's dev server instead. Any other
// owl:imports (SKOS, DCTERMS, FOAF...) is dereferenced from the web, through the dev server's
// CORS proxy (.storybook/corsProxy.ts): those hosts send no CORS headers and content-negotiate,
// so a direct browser fetch would fail or get their HTML documentation page.
const localGraphs = new Map<string, URL>([
  [
    "https://data.norg.nl/def/begrippenkader#",
    new URL("../examples/nl-sbb-begrippenkader/model.ttl", import.meta.url),
  ],
  [
    "https://data.norg.nl/def/opendata#",
    new URL("../examples/dcat-ap-nl-catalogus/model.ttl", import.meta.url),
  ],
  [
    "http://nlbegrip.nl/def/skosapnl#",
    new URL("../examples/nl-sbb-begrippenkader/imports/skosapnl.ttl", import.meta.url),
  ],
  [
    "http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/",
    new URL("../examples/dcat-ap-nl-catalogus/imports/dcat-ap-nl-SHACL.ttl", import.meta.url),
  ],
  [
    "https://semiceu.github.io/DCAT-AP/releases/3.0.0/html/shacl/shapes.ttl",
    new URL("../examples/dcat-ap-nl-catalogus/imports/dcat-ap-eu-SHACL.ttl", import.meta.url),
  ],
]);

// A relative path resolves against the page's own origin, so the proxy is fetched same-origin.
const proxiedUrl = (target: string): URL =>
  new URL(`${CORS_PROXY_PATH}?url=${encodeURIComponent(target)}`, location.href);

// The story is the host here: it decides where a graph comes from, tags every quad with the
// graph IRI it was asked for and hands over the prefixes the document declared. dereferenceUrl
// only reports prefixes when it actually fetches, so every call gets a fresh fetch cache.
const loadGraph: LoadGraph = async (graph: NamedNode) => {
  const url = localGraphs.get(graph.value) ?? proxiedUrl(graph.value);
  const prefixes = new Map<string, string>();
  const store = await dereferenceUrl(url, new Map<string, Promise<Quad[]>>(), undefined, prefixes);
  return {
    quads: store
      .getQuads()
      .map((quad) => factory.quad(quad.subject, quad.predicate, quad.object, graph)),
    prefixes: Object.fromEntries(prefixes),
  };
};

type Story = StoryObj<typeof ShaclManager>;

export default {
  title: "ShaclManager",
  component: ShaclManager,
  // The manager is a whole app screen: no padding around it.
  parameters: { layout: "fullscreen" },
};

export const Default: Story = {
  name: "Begrippenkader (NL-SBB)",
  args: {
    dataModelIRI: factory.namedNode("https://data.norg.nl/def/begrippenkader#"),
    loadGraph,
    // Resolving marks the changes saved.
    onSubmit: fn(async () => {}),
  },
};

export const DcatApNl: Story = {
  name: "Open data catalogue (DCAT-AP-NL)",
  args: {
    ...Default.args,
    dataModelIRI: factory.namedNode("https://data.norg.nl/def/opendata#"),
  },
};
