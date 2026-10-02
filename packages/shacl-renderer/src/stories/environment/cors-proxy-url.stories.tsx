import type { StoryObj } from "@storybook/react-vite";
import { spyOn, within } from "storybook/test";
import { factory } from "@/helpers/factory.ts";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";

type Story = StoryObj<ShaclRendererProps>;

// Environment.corsProxyUrl: a fallback URL prefix tried once, only after a direct fetch fails - see
// helpers/corsProxy.ts's withCorsProxy and preprocess/ontologyLabels.ts's own use of it for
// dereferencing an unnamed property's sh:path (the fastest of its handful of call sites to exercise
// here, since it has no multi-attempt retry/backoff of its own, unlike resolveRdfSources.ts's
// shapesGraph/dataGraph loading).
//
// Each story below uses its own dead URL, never reused across the two - the underlying Comunica
// QueryEngine is a module-level singleton (see ontologyLabels.ts's own getEngine()) shared across
// every story in this file, and it caches a dereferenced source internally; reusing one URL could
// let the second story's query silently reuse the first story's already-failed attempt instead of
// exercising the fetch stub again (see ontologyLabels.test.ts's own comment on this exact gotcha).
const CORS_PROXY_URL = "https://cors-proxy-demo.example/?url=";

function stubFetch(deadUrl: string, proxiedUrl: string): void {
  const original = globalThis.fetch.bind(globalThis);
  spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const href = input instanceof Request ? input.url : input.toString();
    if (href === deadUrl) return new Response("Bad Gateway", { status: 502 });
    if (href === proxiedUrl) {
      return new Response(
        `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . <${deadUrl}> rdfs:label "Name"@en .`,
        { status: 200, headers: { "content-type": "text/turtle" } },
      );
    }
    return original(input as RequestInfo, init);
  });
}

function argsFor(deadUrl: string): ShaclRendererProps {
  const shapesGraph = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix ex: <http://example.org/> .
    ex:shape a sh:NodeShape ;
      sh:targetClass ex:Organization ;
      sh:property [ sh:path <${deadUrl}> ; sh:datatype xsd:string ] .
  `;
  const dataGraph = `
    @prefix ex: <http://example.org/> .
    ex:data a ex:Organization ; <${deadUrl}> "Acme" .
  `;
  return {
    shapesGraph,
    dataGraph,
    focusNode: factory.namedNode("http://example.org/data"),
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    enableMissingPropertyNameDereferencing: true,
  };
}

export default {
  title: "Environment/corsProxyUrl",
  component: ShaclRenderer,
};

const withoutProxyUrl = "http://cors-proxy-demo.example/without-proxy/name";

export const withoutCorsProxyUrl: Story = {
  name: "Without corsProxyUrl, a direct-fetch failure is never retried through a proxy",
  args: argsFor(withoutProxyUrl),
  loaders: [
    async () => {
      stubFetch(withoutProxyUrl, `${CORS_PROXY_URL}${encodeURIComponent(withoutProxyUrl)}`);
      return {};
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Acme", {}, { timeout: 5000 });
    // The direct fetch 502s and nothing else is tried - propertyLabel() falls back to the sh:path
    // predicate's own local name.
    await canvas.findByText("name", {}, { timeout: 5000 });
  },
};

const withProxyUrl = "http://cors-proxy-demo.example/with-proxy/name";

export const withCorsProxyUrl: Story = {
  name: "With corsProxyUrl, the same failure falls back to the proxied URL and succeeds",
  args: { ...argsFor(withProxyUrl), corsProxyUrl: CORS_PROXY_URL },
  loaders: [
    async () => {
      stubFetch(withProxyUrl, `${CORS_PROXY_URL}${encodeURIComponent(withProxyUrl)}`);
      return {};
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Acme", {}, { timeout: 5000 });
    await canvas.findByText("Name", {}, { timeout: 5000 });
  },
};
