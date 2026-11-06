import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:href makes a property's values a link to the href found on the focus node; st:cssClass puts
// class names of the shape's own on a property's or a group's element.
export default {
  title: "Shapes/st:href and st:cssClass",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix st: <http://shapething.com/> .
  @prefix ex: <http://example.org/> .
  ex:details a sh:PropertyGroup ; st:cssClass "details card" .
  ex:shape a sh:NodeShape ;
    sh:property [
      sh:path rdfs:label ; sh:name "" ; sh:order 0 ;
      shui:viewer shui:LiteralViewer ;
      st:href schema:url ; st:cssClass "name" ;
    ] ;
    sh:property [
      sh:path schema:knows ; sh:name "Knows"@en ; sh:order 1 ; sh:group ex:details ;
      shui:viewer shui:LabelViewer ;
      st:href schema:url ;
    ] .
`;
const dataGraph = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:alice rdfs:label "Alice" ; schema:url "/people/alice" ; schema:knows ex:bob .
  ex:bob rdfs:label "Bob" .
`;

export const hrefAndCssClass: Story = {
  name: "A name links to the href of its resource, and the shape's classes are on the elements",
  args: {
    shapesGraph,
    dataGraph,
    mode: "view",
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/alice"),
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = await canvas.findByRole("link", { name: "Alice" });
    await expect(name).toHaveAttribute("href", "/people/alice");
    await expect(name.closest(".st-form-element")).toHaveClass("name");

    // The value's own link (shui:LabelViewer's) is left out inside the st:href link: one link,
    // to the href, around Bob's name.
    const bob = await canvas.findByRole("link", { name: "Bob" });
    await expect(bob).toHaveAttribute("href", "/people/alice");
    await expect(bob.querySelector("a")).toBeNull();

    await waitFor(() =>
      expect(canvasElement.querySelector(".st-property-group")).toHaveClass("details", "card"),
    );
  },
};
