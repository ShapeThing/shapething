import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:GeoEditor is a ShapeThing-original editor, not part of the SHACL 1.2 Core spec or the shui:
// extension proposal - it lives in its own stories folder rather than alongside the spec-
// conformance suite, colocated with its implementation (see widget.tsx). Draw a point/line/
// polygon/rectangle/circle with the toolbar in the map's top-left corner, or select and drag/
// reshape/rotate/delete one of the two already-drawn points - every change writes straight back
// to `ex:location` as a GeoSPARQL WKT literal (see geometry.ts). No play() interaction test: the
// toolbar draws onto a WebGL canvas, which isn't something a scripted click sequence can drive
// meaningfully - see geometry.test.ts for the read/write conversion logic this widget relies on.
export default {
  title: "ShapeThing/Editors/st:GeoEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stGeoEditor: Story = {
  name: "Two already-drawn points, ready to add/edit more",
  args: argsByTestFile("st-geo-editor.ttl", import.meta.url),
};
