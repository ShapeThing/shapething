import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:AddressEditor is a ShapeThing-original editor (ported from shacl-renderer's own
// AddressEditor), not part of the SHACL 1.2 Core spec or the shui: extension proposal - it lives
// in its own stories folder rather than alongside the spec-conformance suite. It edits a nested
// schema:PostalAddress-shaped node's own fixed sub-fields, filled in wholesale from a chosen
// Nominatim (OpenStreetMap) search result - both stories below render an already-filled-in
// address rather than driving the search dropdown itself, since that would depend on a live
// network call to nominatim.openstreetmap.org. Unlike most editors here, st:AddressEditor is
// opt-in only (see score.ttl) - a shape must declare `shui:editor st:AddressEditor` explicitly.
export default {
  title: "ShapeThing/Editors/st:AddressEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stAddressEditor: Story = {
  name: "An already-filled-in address value",
  args: argsByTestFile("st-address-editor.ttl", import.meta.url),
};

export const stAddressEditorWithCountries: Story = {
  name: "st:osmCountries restricts search to one country",
  args: argsByTestFile("st-address-editor-with-countries.ttl", import.meta.url),
};
