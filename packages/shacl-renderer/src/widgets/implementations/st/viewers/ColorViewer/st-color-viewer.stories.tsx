import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:ColorViewer is a ShapeThing-original viewer, not part of the SHACL 1.2 Core spec or the shui:
// extension proposal - it lives in its own stories folder rather than alongside the spec-
// conformance suite, colocated with its implementation (see widget.tsx). Read-only counterpart to
// st:ColorEditor: same value convention (a blank node carrying st:hue/st:saturation/st:lightness,
// genuine CSS HSL notation), rendered as a swatch next to the hex text (converted from HSL only
// for display).
export default {
  title: "Specifications/ShapeThing (living document)/Viewers/st:ColorViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stColorViewer: Story = {
  name: "An already-selected color value",
  args: { ...argsByTestFile("st-color-viewer.ttl", import.meta.url), mode: "view" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The fixture's stored HSL (h=217.22, s=91.22, l=59.80) round-trips back to "#3b82f6" via
    // helpers/colorBuckets.ts's hslToHex.
    await waitFor(() => expect(canvas.getByText("#3b82f6")).toBeInTheDocument());
  },
};
