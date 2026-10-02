import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// sh:defaultValue is where a *new* value starts (see structure/defaultValues.ts): a brand-new
// resource is created with its shapes' defaults already written - so what the form shows is what
// gets submitted - while an existing resource that doesn't state the property is left alone.
export default {
  title: "Specifications/SHACL core 1.2/8. Non-Validating Shape Characteristics/sh:defaultValue",
  component: ShaclRenderer,
};

let submitted: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitted = result;
};

const inputFor = (canvasElement: HTMLElement, label: string) =>
  waitFor(() => {
    const labelElement = [...canvasElement.querySelectorAll("label")].find(
      (element) => element.textContent?.trim() === label,
    );
    const input = labelElement?.closest(".st-form-element")?.querySelector("input");
    if (!input) throw new Error(`No input for "${label}" yet`);
    return input;
  });

export const newResourceStartsWithDefaults: Story = {
  name: "A new resource starts out with the defaults, and submits them",
  args: { ...argsByTestFile("8 sh-default-value.a.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitted = undefined;
    const canvas = within(canvasElement);
    await waitFor(async () => expect(await inputFor(canvasElement, "Country")).toHaveValue("Netherlands"));
    expect(await inputFor(canvasElement, "Number of children")).toHaveValue(0);
    expect(await inputFor(canvasElement, "Given name")).toHaveValue("");

    // Still a "Create": nothing beyond the seeded defaults has been entered yet.
    await userEvent.click(canvas.getByRole("button", { name: "Create" }));
    const result = await waitFor(() => {
      if (!submitted) throw new Error("onSubmit has not fired yet");
      return submitted;
    });
    expect(result.additions.map((quad) => quad.object.value).sort()).toEqual(["0", "Netherlands"]);
  },
};

export const defaultsAreNotUndoable: Story = {
  name: "Undo doesn't go past the defaults the form started with",
  args: { ...argsByTestFile("8 sh-default-value.a.ttl", import.meta.url), enableUndoRedo: true },
  play: async ({ canvasElement }) => {
    const country = await inputFor(canvasElement, "Country");
    await waitFor(() => expect(country).toHaveValue("Netherlands"));
    // Focus somewhere that isn't a text input, so Ctrl+Z reaches the form's own undo.
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Create" }));
    await userEvent.keyboard("{Control>}z{/Control}");
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(await inputFor(canvasElement, "Country")).toHaveValue("Netherlands");
    expect(await inputFor(canvasElement, "Number of children")).toHaveValue(0);
  },
};

export const existingResourceIsLeftAlone: Story = {
  name: "An existing resource without the property is not filled in",
  args: argsByTestFile("8 sh-default-value.b.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    await waitFor(async () => expect(await inputFor(canvasElement, "Given name")).toHaveValue("Hendrik"));
    expect(await inputFor(canvasElement, "Country")).toHaveValue("");
  },
};
