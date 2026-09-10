import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:TabbedPropertyGroup is a ShapeThing-original group widget, not part of the SHACL core 1.2
// spec or the shui: extension proposal (unlike sh:PropertyGroup itself, see "SHACL UI 1.2"'s 8.7
// story) - it lives in its own stories folder rather than alongside the spec-conformance suite.
export default {
  title: "Specifications/ShapeThing (living document)/Groups/st:TabbedPropertyGroup",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stTabbedPropertyGroup: Story = {
  name: "A wizard-style group showing one step's fields at a time, switched via a tab nav",
  args: argsByTestFile("st-tabbed-property-group.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Both sh:PropertyGroups carry st:TabbedPropertyGroup, so a single shared tab nav renders once,
    // above whichever step is currently active - not one nav per group.
    const tablist = await canvas.findByRole("tablist");
    const personalDetailsTab = within(tablist).getByRole("tab", { name: "Personal details" });
    const addressTab = within(tablist).getByRole("tab", { name: "Address" });

    // Lowest sh:order wins as the initial step: its fields are visible, the other step's fields are
    // not in the document at all (the inactive tab's widget renders null, not just hidden).
    expect(personalDetailsTab).toHaveAttribute("aria-selected", "true");
    expect(addressTab).toHaveAttribute("aria-selected", "false");
    expect(await canvas.findByDisplayValue("Hendrik")).toBeInTheDocument();
    expect(await canvas.findByDisplayValue("Jansen")).toBeInTheDocument();
    expect(canvas.queryByDisplayValue("Dam 1")).not.toBeInTheDocument();

    // Switching tabs swaps which step's fields are mounted, without touching any data - "Dam 1"
    // (already in the fixture data) simply wasn't shown before, not created by switching to it.
    await userEvent.click(addressTab);
    expect(addressTab).toHaveAttribute("aria-selected", "true");
    expect(personalDetailsTab).toHaveAttribute("aria-selected", "false");
    expect(await canvas.findByDisplayValue("Dam 1")).toBeInTheDocument();
    expect(canvas.queryByDisplayValue("Hendrik")).not.toBeInTheDocument();
  },
};
