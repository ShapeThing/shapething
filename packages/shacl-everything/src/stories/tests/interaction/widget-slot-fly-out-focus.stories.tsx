import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// WidgetSlot's fly-out visibility, driven by the shared focus tracker (hooks/useActiveElement.tsx):
// LogicalConstraintSwitcher shows while focus is anywhere within the slot (including a nested
// DetailsEditor sub-form's own fields), WidgetSwitcher only while the slot is the *nearest*
// focused .st-property-object__widget - so a nested field's focus shows the nested field's own
// WidgetSwitcher, not the outer one. Reuses details-editor-keyboard-navigation.ttl's sh:or between
// free text and a DetailsEditor-rendered sh:node.
export default {
  title: "Tests/Interaction/WidgetSlot fly-out focus tracking",
  component: ShaclRenderer,
};

const ownFlyOut = (slot: Element) => slot.querySelector(":scope > .st-property-object__fly-out");

export const flyOutFollowsFocus: Story = {
  name: "The fly-out follows focus, with WidgetSwitcher only on the innermost focused value",
  args: {
    ...argsByTestFile("details-editor-keyboard-navigation.ttl", import.meta.url),
    enableLogicalBranchSwitching: true,
    enableWidgetSwitching: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const optionsButton = await canvas.findByRole(
      "button",
      { name: "Field options" },
      { timeout: 5000 },
    );
    const outerSlot = optionsButton.closest(".st-property-object__widget")!;
    expect(outerSlot.getAttribute("data-widget")).toBe("DetailsEditor");
    expect(ownFlyOut(outerSlot)).toBeNull();

    // Focus on the DetailsEditor's own options button: the outer slot is the nearest one, so its
    // fly-out has both switchers.
    optionsButton.focus();
    await waitFor(() => {
      expect(ownFlyOut(outerSlot)?.querySelector(".st-logical-constraint-switcher")).toBeTruthy();
      expect(ownFlyOut(outerSlot)?.querySelector(".st-widget-switcher")).toBeTruthy();
    });

    // Focus moving into a nested field: the outer branch switcher stays, the outer widget
    // switcher gives way to the nested field's own.
    const streetInput = [...canvasElement.querySelectorAll(".st-form-element__label-text")]
      .find((element) => element.textContent?.trim() === "Street")!
      .closest(".st-form-element")!
      .querySelector("input")!;
    const streetSlot = streetInput.closest(".st-property-object__widget")!;
    streetInput.focus();
    await waitFor(() => {
      expect(ownFlyOut(streetSlot)?.querySelector(".st-widget-switcher")).toBeTruthy();
      expect(ownFlyOut(outerSlot)?.querySelector(".st-widget-switcher")).toBeFalsy();
      expect(ownFlyOut(outerSlot)?.querySelector(".st-logical-constraint-switcher")).toBeTruthy();
    });

    // Focus leaving the form entirely closes every fly-out.
    streetInput.blur();
    await waitFor(() =>
      expect(canvasElement.querySelector(".st-property-object__fly-out")).toBeNull(),
    );
  },
};
