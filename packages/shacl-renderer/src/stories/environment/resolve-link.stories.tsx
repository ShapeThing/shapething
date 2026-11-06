import type { StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// ShaclRenderer's resolveLink: every link a viewer renders goes through it, so an embedder can
// point it at a route of its own, keep it in the page, mark it or handle its click.
export default {
  title: "Environment/resolveLink",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:property [ sh:name "Knows"@en ; sh:path schema:knows ; shui:viewer shui:LabelViewer ] ;
    sh:property [ sh:name "Website"@en ; sh:path schema:url ; shui:viewer shui:IRIViewer ] .
`;
const dataGraph = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:alice schema:knows ex:bob ; schema:url <https://alice.example/> .
  ex:bob rdfs:label "Bob" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  mode: "view",
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/alice"),
} as ShaclRendererProps;

const onBobClick = fn();

export const rewritesLinks: Story = {
  name: "A link to a resource points at a route of the embedder's own, kept in the page",
  args: {
    ...baseArgs,
    resolveLink: (href: string) =>
      href.startsWith("http://example.org/")
        ? {
            href: `#${href.split("/").pop()}`,
            target: undefined,
            "aria-current": "true",
            onClick: (event) => {
              event.preventDefault();
              onBobClick(href);
            },
          }
        : undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bob = await canvas.findByRole("link", { name: "Bob" });
    await expect(bob).toHaveAttribute("href", "#bob");
    await expect(bob).not.toHaveAttribute("target");
    await expect(bob).toHaveAttribute("aria-current", "true");
    await userEvent.click(bob);
    await expect(onBobClick).toHaveBeenCalledWith("http://example.org/bob");

    // A link the resolver returns nothing for is left as it is.
    const website = await canvas.findByRole("link", { name: "https://alice.example/" });
    await expect(website).toHaveAttribute("href", "https://alice.example/");
    await expect(website).toHaveAttribute("target", "_blank");
  },
};
