import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:VerticalTabbedPropertyGroup is a ShapeThing-original group widget, not part of the SHACL
// core 1.2 spec or the shui: extension proposal (unlike sh:PropertyGroup itself, see "SHACL UI
// 1.2"'s 8.7 story) - it lives in its own stories folder rather than alongside the spec-
// conformance suite.
export default {
  title: "Specifications/ShapeThing (living document)/Groups/st:VerticalTabbedPropertyGroup",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stVerticalTabbedPropertyGroup: Story = {
  name: "A Drupal-style vertical tab nav, one tab with an st:icon Iconify name, one with a plain image IRI",
  args: argsByTestFile("st-vertical-tabbed-property-group.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const tablist = await canvas.findByRole("tablist");
    const personalDetailsTab = within(tablist).getByRole("tab", { name: /Personal details/ });
    const addressTab = within(tablist).getByRole("tab", { name: /Address/ });

    // Lowest sh:order wins as the initial active tab: its fields are visible, the other tab's
    // fields aren't in the document at all.
    expect(personalDetailsTab).toHaveAttribute("aria-selected", "true");
    expect(addressTab).toHaveAttribute("aria-selected", "false");
    expect(await canvas.findByDisplayValue("Hendrik")).toBeInTheDocument();
    expect(await canvas.findByDisplayValue("Jansen")).toBeInTheDocument();
    expect(canvas.queryByDisplayValue("Dam 1")).not.toBeInTheDocument();

    // st:icon as a plain IRI (the address tab) always renders as a plain <img> (alt="" makes it
    // decorative, so it's queried directly rather than via getByRole) - both tabs' own nav
    // buttons render together (see widget.tsx), only the panel content switches.
    const addressIcon = addressTab.querySelector("img");
    if (!addressIcon) throw new Error("expected the address tab to render an <img> icon");
    expect(addressIcon).toHaveAttribute(
      "src",
      "https://upload.wikimedia.org/wikipedia/commons/e/ec/Home-icon.svg",
    );

    // st:icon as an iconify-typed literal (the personal-details tab) renders via @iconify/react's
    // <Icon/> instead - not asserted further here since resolving its SVG depends on a live
    // network call to api.iconify.design (same convention as IconifyEditor/IconifyViewer's own
    // stories, which don't assert on the resolved icon markup either).
    expect(within(personalDetailsTab).getByText("Personal details")).toBeInTheDocument();

    // Switching tabs swaps which tab's fields are mounted, without touching any data - "Dam 1"
    // (already in the fixture data) simply wasn't shown before, not created by switching to it.
    await userEvent.click(addressTab);
    expect(addressTab).toHaveAttribute("aria-selected", "true");
    expect(personalDetailsTab).toHaveAttribute("aria-selected", "false");
    expect(await canvas.findByDisplayValue("Dam 1")).toBeInTheDocument();
    expect(canvas.queryByDisplayValue("Hendrik")).not.toBeInTheDocument();
  },
};
