import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:DescriptionRole is the deprecated, ShapeThing-original predecessor of shui:DescriptionRole
// (see SHACL UI 1.2's 12.3.4 story), still recognized as an alias of it (see resolution/label.ts's
// descriptionRolePropertyPaths) - this story keeps existing shapes that use it covered.
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
