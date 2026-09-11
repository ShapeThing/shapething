import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/Auto-grow textarea after CSS import",
  component: ShaclRenderer,
  args: argsByTestFile("auto-grow-textarea-after-css-import.ttl", import.meta.url),
};

function findTextarea(canvasElement: HTMLElement): HTMLTextAreaElement {
  const textarea = canvasElement.querySelector<HTMLTextAreaElement>("textarea.st-input");
  if (!textarea) throw new Error("Could not find the Notes textarea");
  return textarea;
}

function findGroup(canvasElement: HTMLElement): HTMLElement {
  const group = canvasElement.querySelector<HTMLElement>(
    '[data-iri="http://example.org/notesGroup"]',
  );
  if (!group) throw new Error("Could not find the Notes property group");
  return group;
}

// useAutoGrowTextarea (outputs/render/hooks/) measures the textarea's content height in a
// useLayoutEffect against whatever width its layout has *at that instant*, keyed only on
// [ref, value] - it never re-measures on its own once the value stops changing. In production,
// a shape-declared st:cssImport stylesheet (resolution/cssImports.ts) is appended to
// document.head from a later useEffect and then has to load over the network before it applies -
// so an already-populated field (nothing left to type, nothing to re-trigger the value-keyed
// effect) that gets narrowed once that stylesheet lands (exactly what recipes-and-chefs.css's
// grid layout does to schema:description's field) is stuck with its stale, too-short
// pre-stylesheet height, which then clips the now-more-wrapped text since the widget also sets
// overflow: hidden. A real st:cssImport's network load is too fast on a local dev/test server to
// reliably land after the initial measurement, so this test reproduces the same "container
// narrows with no value change" condition deterministically, by narrowing the group's own width
// directly once the field has already mounted.
export const textareaCoversItsContentAfterContainerNarrows: Story = {
  play: async ({ canvasElement }) => {
    const textarea = await waitFor(() => findTextarea(canvasElement));
    const group = findGroup(canvasElement);

    group.style.width = "160px";

    // The narrower layout reflows the textarea onto more lines - its auto-grown height must
    // still cover every one of them, not the stale height measured before the width changed.
    await waitFor(() => {
      // A sub-pixel rounding difference between scrollHeight and clientHeight is normal - only a
      // stale, uncorrected height leaves a real multi-line gap between the two.
      expect(textarea.scrollHeight).toBeLessThanOrEqual(textarea.clientHeight + 2);
    });
  },
};
