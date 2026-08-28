import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.1 shui:AutoCompleteEditor",
  component: ShaclRenderer,
};

export const shuiAutoCompleteEditor: Story = {
  name: "Auto-complete by class instances",
  args: argsByTestFile("10.1.1 shui-auto-complete-editor.ttl", import.meta.url),
};

export const shuiAutoCompleteEditorFederatedSearch: Story = {
  name: "Federated search (shui:searchQuery)",
  args: argsByTestFile("10.1.1 shui-auto-complete-editor-federated-search.ttl", import.meta.url),
};

export const shuiAutoCompleteEditorInvalidSearchResults: Story = {
  name: "Search results outside sh:in are filtered out (spec §10.2)",
  args: argsByTestFile(
    "10.1.1 shui-auto-complete-editor-invalid-search-results.ttl",
    import.meta.url,
  ),
};
