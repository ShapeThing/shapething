import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/Default object per parent",
  component: ShaclRenderer,
};

export const siblingNestedFormsGetTheirOwnDefault: Story = {
  name: "Sibling nested forms of the same shape each seed their own empty value",
  args: argsByTestFile("default-object-per-parent.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // Each author's nested address form holds exactly one text field: its Street.
    const streets = () =>
      Array.from(
        canvasElement.querySelectorAll<HTMLInputElement>(
          '[data-widget="DetailsEditor"] [data-widget="DetailsEditor"] [data-widget="TextFieldEditor"] input',
        ),
      );

    await waitFor(() => expect(streets()).toHaveLength(2), { timeout: 5000 });

    await userEvent.type(streets()[0], "Dam 1");
    await userEvent.tab();

    // Filling the first author's address must neither leak into the second author's still-empty
    // one (useDefaultObject used to key its cached placeholder on the property shape alone,
    // handing both authors the same blank node) nor drop the first one's own now-linked value
    // (DetailsEditor links it from an effect, which useReactiveRead used to miss).
    await waitFor(() => {
      expect(streets().map((input) => input.value)).toEqual(["Dam 1", ""]);
    });
  },
};
