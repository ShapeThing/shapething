import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:DescriptionRole is a ShapeThing-original shui:propertyRole value for a value's longer,
// free-text summary (see resolution/label.ts's descriptionRolePropertyPaths). It's rendered by the
// Teaser card - here, the AutoCompleteEditor's facet-search modal results.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:DescriptionRole",
  component: ShaclRenderer,
};

export const stDescriptionRole: Story = {
  name: "Facet-search results show each value's st:DescriptionRole blurb",
  args: {
    ...argsByTestFile("st-description-role.ttl", import.meta.url),
    enableFacetSearchForAutocomplete: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Edit" }));

    const dialog = within(await canvas.findByRole("dialog"));
    await expect(dialog.findByText("Japan")).resolves.toBeVisible();
    await expect(
      dialog.findByText(/famous for its canals, tulips and windmills/),
    ).resolves.toBeVisible();
    await expect(
      dialog.findByText(/ancient temples with cutting-edge technology/),
    ).resolves.toBeVisible();
  },
};
