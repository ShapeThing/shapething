import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:CollapsiblePropertyGroup is a ShapeThing-original group widget, not part of the SHACL 1.2
// Core spec or the shui: extension proposal (unlike sh:PropertyGroup itself, see "SHACL 1.2 UI"'s
// 10.3.1 story) - it lives in its own stories folder rather than alongside the spec-conformance
// suite.
export default {
  title: "Shacl Renderer/ShapeThing/Groups/st:CollapsiblePropertyGroup",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stCollapsiblePropertyGroup: Story = {
  name: "A collapsible group nesting two plain sh:PropertyGroups",
  args: argsByTestFile("st-collapsible-property-group.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // st:CollapsiblePropertyGroup renders as a native <details open>/<summary>, wrapping two
    // nested sh:PropertyGroup <fieldset>s - proving both nesting and type-based widget selection
    // (this group carries both sh:PropertyGroup and st:CollapsiblePropertyGroup) at once.
    const summary = await within(canvasElement).findByText("Personal details");
    const details = summary.closest("details");
    expect(details).toBeTruthy();
    expect(details).toHaveAttribute("open");

    const scope = within(details as HTMLElement);
    const nameGroup = await scope.findByRole("group", { name: "Name" });
    const addressGroup = await scope.findByRole("group", { name: "Address" });
    // Widget resolution (react-query) is async, so the actual <input> inside each grouped
    // property settles slightly after its <fieldset>/<legend> chrome - findByDisplayValue retries
    // until it does, unlike a plain getByDisplayValue.
    expect(await within(nameGroup).findByDisplayValue("Hendrik")).toBeInTheDocument();
    expect(await within(nameGroup).findByDisplayValue("Jansen")).toBeInTheDocument();
    expect(await within(addressGroup).findByDisplayValue("Dam 1")).toBeInTheDocument();
  },
};
