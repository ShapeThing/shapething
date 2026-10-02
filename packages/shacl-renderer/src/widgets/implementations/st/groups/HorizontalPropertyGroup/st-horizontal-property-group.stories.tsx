import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:HorizontalPropertyGroup is a ShapeThing-original group widget, not part of the SHACL core
// 1.2 spec or the shui: extension proposal (unlike sh:PropertyGroup itself, see "SHACL UI 1.2"'s
// 8.7 story) - it lives in its own stories folder rather than alongside the spec-conformance
// suite.
export default {
  title: "Specifications/ShapeThing (living document)/Groups/st:HorizontalPropertyGroup",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stHorizontalPropertyGroup: Story = {
  name: "A group laying its properties out in a row instead of stacked",
  args: argsByTestFile("st-horizontal-property-group.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // st:HorizontalPropertyGroup renders as a <fieldset>/<legend>, same as plain sh:PropertyGroup,
    // but carries an extra CSS class that switches its body to a row layout - the class is the
    // only DOM evidence distinguishing it from the default widget (both resolve to a "group" role).
    const group = await within(canvasElement).findByRole("group", { name: "Name" });
    expect(group.tagName).toEqual("FIELDSET");
    expect(group).toHaveClass("st-property-group--horizontal");

    // Widget resolution (react-query) is async, so the actual <input>s settle slightly after the
    // <fieldset>/<legend> chrome - findByDisplayValue retries until they do, unlike getByDisplayValue.
    expect(await within(group).findByDisplayValue("Hendrik")).toBeInTheDocument();
    expect(await within(group).findByDisplayValue("Jansen")).toBeInTheDocument();
  },
};
