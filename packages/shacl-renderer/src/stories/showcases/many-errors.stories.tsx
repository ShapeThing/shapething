import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { testingEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases/Many errors",
  component: ShaclRenderer,
  args: testingEnvironment,
};

// A long form (24 fields over four groups) where nearly every value is invalid, so errors sit both
// above and below the fold - for working on navigating between validation errors. Existing data
// is validated on load, so all errors show without submitting first.
export const manyErrors: Story = {
  name: "Many errors",
  args: argsByTestFile("many-errors.ttl", import.meta.url),
};
