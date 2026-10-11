import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Specifications/SHACL UI 1.2/11. Property Roles/11.3 Built-in Property Roles/12.3.4 shui:DescriptionRole",
  component: ShaclRenderer,
};

// The spec's example 43 (<#Comment> in the .ttl): each country's rdfs:comment is resolved via
// resolution/label.ts's valueNodeDescription and shown on its Teaser card in the AutoCompleteEditor's
// facet-search modal - an xsd:string, an @en langString, and an rdf:HTML value flattened to text.
export const descriptionRole: Story = {
  name: "Facet-search results show each value's shui:DescriptionRole text",
  args: {
    ...argsByTestFile("12.3.4 shui-description-role.ttl", import.meta.url),
    enableFacetSearchForAutocomplete: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Edit" }));

    const dialog = within(await canvas.findByRole("dialog"));
    await expect(
      dialog.findByText(/famous for its canals, tulips and windmills/),
    ).resolves.toBeVisible();
    await expect(
      dialog.findByText(/ancient temples with cutting-edge technology/),
    ).resolves.toBeVisible();
    await expect(
      dialog.findByText("A volcanic island nation of glaciers and geysers."),
    ).resolves.toBeVisible();
    await expect(dialog.queryByText(/<strong>/)).toBeNull();
  },
};
