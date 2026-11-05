import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:dirty is a ShapeThing constraint for edit mode, registered with shacl-engine (see
// validation/dirtyConstraint.ts): `st:dirty true` conforms only while the data graph differs from
// the data the form was opened with, `st:dirty false` only while it doesn't.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:dirty",
  component: ShaclRenderer,
};

export const stDirtyTriggersOnChange: Story = {
  name: "st:dirty triggers on change",
  args: argsByTestFile("st-dirty.ttl", import.meta.url),
};
