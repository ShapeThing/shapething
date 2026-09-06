import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:IconifyEditor is a ShapeThing-original editor (ported from shacl-renderer's own
// IconifyEditor), not part of the SHACL 1.2 Core spec or the shui: extension proposal - it lives
// in its own stories folder rather than alongside the spec-conformance suite. Its value convention
// is a plain string literal typed with the iconifyDatatype sentinel (sh:datatype
// <https://iconify.design>, see namespaces.ts) naming an icon in "<collection>:<icon>" form (e.g.
// "mdi:home"), which @iconify/react's own <Icon/> resolves live against iconify.design's icon
// data - both stories below render an already-selected icon rather than driving the search
// dropdown itself, since that would depend on a live network call to api.iconify.design.
export default {
  title: "ShapeThing/Editors/st:IconifyEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stIconifyEditor: Story = {
  name: "An already-selected icon value",
  args: argsByTestFile("st-iconify-editor.ttl", import.meta.url),
};

export const stIconifyEditorWithCollections: Story = {
  name: "st:iconifyCollections restricts search to one icon set",
  args: argsByTestFile("st-iconify-editor-with-collections.ttl", import.meta.url),
};
