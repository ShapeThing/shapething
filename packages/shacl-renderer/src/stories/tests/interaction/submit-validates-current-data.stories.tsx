import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// Submitting decides on validation of the data as it is at that moment, not on the last live
// validation run: that one starts a moment after an edit and takes time itself, so right after
// typing it can still describe the form before the edit.
export default {
  title: "Tests/Interaction/Submit validates the current data",
  component: ShaclRenderer,
};

let submitted: SubmitResult[] = [];
const onSubmit = (result: SubmitResult) => {
  submitted.push(result);
};

const nameInput = (root: HTMLElement) =>
  waitFor(() => {
    const input = root.querySelector<HTMLInputElement>('[data-widget="TextFieldEditor"] input');
    if (!input) throw new Error("No name field yet");
    return input;
  });

export const requiredValueTypedThenEnter: Story = {
  name: "A required value typed just now, then Enter, submits",
  args: { ...argsByTestFile("submit-validates-current-data.a.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitted = [];
    const input = await nameInput(canvasElement);
    // Wait for the first validation run (the empty, required name), so it is the stale one.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await userEvent.type(input, "Grace{Enter}");

    await waitFor(() => expect(submitted).toHaveLength(1));
    expect(submitted[0].additions.map((quad) => quad.object.value)).toContain("Grace");
  },
};

// An emptied field is written as "", which sh:minCount alone allows: sh:minLength 1 doesn't.
export const requiredValueClearedThenSubmit: Story = {
  name: "A value emptied just now, then Enter, is held back",
  args: { ...argsByTestFile("submit-validates-current-data.b.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitted = [];
    const input = await nameInput(canvasElement);
    await waitFor(() => expect(input).toHaveValue("Ada"));
    // The first validation run (a valid name) is the stale one.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await userEvent.clear(input);
    await userEvent.keyboard("{Enter}");

    // Long enough for a submit to have arrived, had it not been held back.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(submitted).toHaveLength(0);
  },
};
