import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { parseRdf } from "@/helpers/rdf.ts";
import { sparqlEndpointFetch } from "@/facets/testing/sparqlEndpointShim.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.facetsEndpoint: facet mode only. Every facet value, count and bound is a SPARQL query
// sent to this endpoint instead of being computed over the local dataGraph - here the local
// dataGraph is deliberately empty, so everything the facets show must have come from the endpoint.
// The "endpoint" is window.fetch patched to answer SPARQL protocol requests for ENDPOINT from
// `data` below (facets/testing/sparqlEndpointShim.ts) - the same HTTP round trip a real one gets.
export default {
  title: "Environment/facetsEndpoint",
  component: ShaclRenderer,
};

const ENDPOINT = "https://facets-endpoint.test/sparql";

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property [ sh:name "Category"@en ; sh:path schema:category ; sh:class ex:Category ] ,
      [ sh:name "Price"@en ; sh:path schema:price ; sh:datatype xsd:decimal ] .
`;

const data = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:Electronics a ex:Category ; rdfs:label "Electronics"@en .
  ex:Books a ex:Category ; rdfs:label "Books"@en .
  ex:widget a schema:Product ; schema:category ex:Electronics ; schema:price 19.99 .
  ex:gadget a schema:Product ; schema:category ex:Electronics ; schema:price 42.50 .
  ex:novel a schema:Product ; schema:category ex:Books ; schema:price 12.00 .
`;

let endpointFetch: ReturnType<typeof sparqlEndpointFetch> | undefined;

export const facetsFromAnEndpoint: Story = {
  name: "Options, counts and bounds all come from the SPARQL endpoint",
  args: {
    shapesGraph,
    // Empty on purpose - everything the facets show comes from ENDPOINT.
    dataGraph: "@prefix ex: <http://example.org/> .",
    mode: "facet",
    facetsEndpoint: ENDPOINT,
    enableFacetOptionCounts: true,
  },
  beforeEach: async () => {
    endpointFetch = sparqlEndpointFetch(await parseRdf(data, "text/turtle"));
    const shim = endpointFetch;
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      return url.startsWith(ENDPOINT) ? shim(input, init) : originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Options with their counts and labels, none of which exist in the (empty) local dataGraph.
    await canvas.findByLabelText("Electronics 2", undefined, { timeout: 5000 });
    await canvas.findByLabelText("Books 1");

    // The price range's bounds come from a MIN/MAX query.
    const priceContainer = (await canvas.findByText("Price")).closest(".st-form-element") as HTMLElement;
    const [minPrice] = within(priceContainer).getAllByRole("spinbutton") as HTMLInputElement[];
    await waitFor(() => expect(minPrice).toHaveAttribute("placeholder", "12"));

    // Picking a category narrows the price facet's own match count - computed by the endpoint.
    await userEvent.click(canvas.getByLabelText("Electronics 2"));
    await userEvent.type(minPrice, "15");
    await within(priceContainer).findByText("2");

    // Every facet query went out as one aggregate query, not triple-pattern fragments.
    expect(endpointFetch!.requests.some((query) => /COUNT\(DISTINCT \?this\)/.test(query))).toBe(true);
    expect(endpointFetch!.requests.some((query) => /MIN\(\?value\)/.test(query))).toBe(true);
  },
};
