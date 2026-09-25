import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:PropertyPathEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stPropertyPathEditor: Story = {
  name: "An already-filled-in property path value",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
};
