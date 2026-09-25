import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/Choice branch re-detection",
  component: ShaclRenderer,
};

export const replacingAValueReDetectsTheBranch: Story = {
  name: "Replacing a value re-detects the node-level sh:or branch",
  args: argsByTestFile("choice-branch-redetection.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const picker = () => canvasElement.querySelector(".st-choice-element .st-logical-constraint-switcher");

    await waitFor(() => expect(picker()?.textContent).toContain("Starts with A"), {
      timeout: 5000,
    });

    const name = await waitFor(() => {
      const input = canvasElement.querySelector<HTMLInputElement>(
        '[data-widget="TextFieldEditor"] input',
      );
      expect(input).toBeTruthy();
      return input!;
    });
    await userEvent.clear(name);
    await userEvent.type(name, "Banana");
    await userEvent.tab();

    // replaceObject() leaves the focus node's quad count unchanged - the branch must still be
    // re-detected from the new value, not served from a count-keyed cache.
    await waitFor(() => expect(picker()?.textContent).toContain("Starts with B"), {
      timeout: 5000,
    });
  },
};
