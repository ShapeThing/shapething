import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:ColorEditor is a ShapeThing-original editor, not part of the SHACL 1.2 Core spec or the shui:
// extension proposal - it lives in its own stories folder rather than alongside the spec-
// conformance suite, colocated with its implementation (see widget.tsx). Its value convention is a
// plain string literal typed with the colorDatatype sentinel (sh:datatype
// <https://www.w3.org/TR/css-color-4/>, see namespaces.ts) holding a 6-digit hex color (e.g.
// "#3b82f6") - the swatch and the text field both read/write that one literal.
export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:ColorEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stColorEditor: Story = {
  name: "An already-selected color value",
  args: argsByTestFile("st-color-editor.ttl", import.meta.url),
};
