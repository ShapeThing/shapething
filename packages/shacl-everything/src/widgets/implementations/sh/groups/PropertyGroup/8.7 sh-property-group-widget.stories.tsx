import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 Core/8. Non-Validating Shape Characteristics/8.7 sh:group",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shPropertyGroup: Story = {
  name: "Properties grouped under the default sh:PropertyGroup widget",
  args: argsByTestFile("8.7 sh-property-group-widget.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // sh:PropertyGroup renders as a native <fieldset>/<legend> - a <fieldset> gets an implicit
    // ARIA "group" role, named by its <legend>.
    const group = await within(canvasElement).findByRole("group", { name: "Name" });
    expect(group.tagName).toEqual("FIELDSET");
    // Widget resolution (react-query) is async, so the actual <input>s settle slightly after the
    // <fieldset>/<legend> chrome - findByDisplayValue retries until they do, unlike getByDisplayValue.
    expect(await within(group).findByDisplayValue("Hendrik")).toBeInTheDocument();
    expect(await within(group).findByDisplayValue("Jansen")).toBeInTheDocument();
  },
};
