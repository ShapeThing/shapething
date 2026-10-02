import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// Every built-in widget of one kind side by side on a single focus node, in spec order (SHACL UI
// 1.2 §10.1/§10.2 first, then the ShapeThing (living document) st: widgets). Each property's
// sh:name is the widget's compact IRI (prefixed with its spec clause number where it has one) and
// its sh:description the full IRI, so which widget is which is always readable off the form
// itself. See each widget's own story under "Specifications/" for its individual variants.
export default {
  title: "Showcases/All widgets",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const allEditors: Story = {
  name: "Editors",
  args: argsByTestFile("all-editors.ttl", import.meta.url),
};

export const allViewers: Story = {
  name: "Viewers",
  args: { ...argsByTestFile("all-viewers.ttl", import.meta.url), mode: "view" },
};

export const allFacets: Story = {
  name: "Facets",
  args: { ...argsByTestFile("all-facets.ttl", import.meta.url), mode: "facet" },
};
