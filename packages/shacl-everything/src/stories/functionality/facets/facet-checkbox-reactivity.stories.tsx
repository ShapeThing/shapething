import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { sh } from "@/helpers/namespaces.ts";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Facets/Checkbox reactivity",
  component: ShaclRenderer,
};

const { shapesGraph, dataGraph } = argsByTestFile("facet-checkbox-reactivity.ttl", import.meta.url);

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx).
let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

// Regression coverage for a real useSyncExternalStore race: creating a brand-new facet constraint
// used to link its (still-empty) node into filterShape before writing its value, and a sibling
// facet's forced-synchronous re-render (see structure/filterShape.ts's setFilterConstraintForProperty)
// could observe - and permanently cache - that half-written state, leaving a checkbox that never
// shows as checked even though the submitted graph is correct. Exercises the very first click (the
// only moment a node gets created), not just steady-state toggling.
export const categoryCheckboxStaysInSyncWithItsOwnClick: Story = {
  name: "A category checkbox reflects its own click on the very first selection",
  args: { shapesGraph, dataGraph, mode: "facet", onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    const electronics = (await canvas.findByLabelText("Electronics")) as HTMLInputElement;
    const books = (await canvas.findByLabelText("Books")) as HTMLInputElement;

    await userEvent.click(electronics);
    await waitFor(() => expect(electronics.checked).toBe(true));
    await waitFor(() =>
      expect(submitResult?.dataGraph.getQuads(null, sh("in")).length ?? 0).toBeGreaterThan(0),
    );

    await userEvent.click(electronics);
    await waitFor(() => expect(electronics.checked).toBe(false));
    await waitFor(() =>
      expect(submitResult?.dataGraph.getQuads(null, sh("in")).length ?? 0).toBe(0),
    );

    await userEvent.click(books);
    await waitFor(() => expect(books.checked).toBe(true));
    expect(electronics.checked).toBe(false);

    await userEvent.click(electronics);
    await waitFor(() => expect(electronics.checked).toBe(true));
    expect(books.checked).toBe(true);

    await userEvent.click(books);
    await waitFor(() => expect(books.checked).toBe(false));
    expect(electronics.checked).toBe(true);
  },
};
