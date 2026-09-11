import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { ex } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:RadiosCheckboxesEditor is a ShapeThing-original editor, not part of the SHACL 1.2 Core spec
// or the shui: extension proposal - it lives in its own stories folder rather than alongside the
// spec-conformance suite, colocated with its implementation (see widget.tsx). Toppings has no
// sh:maxCount and its value node shape (ex:ToppingShape) carries a shui:DepictionRole path, so it
// renders as clickable topping images (checkboxes, since more than one can be picked); Crust has
// sh:maxCount 1 and no DepictionRole of its own, so it falls back to plain radios.
export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:RadiosCheckboxesEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stRadiosCheckboxesEditor: Story = {
  name: "Pizza builder - image checkboxes (toppings) and plain radios (crust)",
  args: { ...argsByTestFile("st-radios-checkboxes-editor.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    // <#data> already starts with mushroom+basil toppings and a thin crust (see the fixture).
    const pepperoni = (await canvas.findByLabelText("Pepperoni")) as HTMLInputElement;
    const mushroom = (await canvas.findByLabelText("Mushroom")) as HTMLInputElement;
    const basil = (await canvas.findByLabelText("Basil")) as HTMLInputElement;
    expect(pepperoni.type).toBe("checkbox");
    expect(pepperoni.checked).toBe(false);
    expect(mushroom.checked).toBe(true);
    expect(basil.checked).toBe(true);

    // Checking a third topping keeps the other two - an ordinary multi-select add, not a replace.
    await userEvent.click(pepperoni);
    await waitFor(() => expect(pepperoni.checked).toBe(true));
    expect(mushroom.checked).toBe(true);

    const thin = (await canvas.findByLabelText("Thin")) as HTMLInputElement;
    const thick = (await canvas.findByLabelText("Thick")) as HTMLInputElement;
    expect(thin.type).toBe("radio");
    expect(thin.checked).toBe(true);
    expect(thick.checked).toBe(false);

    // Picking the other crust replaces the single value rather than adding to it.
    await userEvent.click(thick);
    await waitFor(() => expect(thick.checked).toBe(true));
    expect(thin.checked).toBe(false);

    const submitButton = await canvas.findByRole("button", { name: "Update" });
    await userEvent.click(submitButton);

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const toppings = submitResult.dataGraph
        .getQuads(null, ex("topping"))
        .map((quad) => quad.object.value)
        .sort();
      expect(toppings).toEqual(
        [ex("mushroom").value, ex("basil").value, ex("pepperoni").value].sort(),
      );
      const crusts = submitResult.dataGraph.getQuads(null, ex("crust")).map((quad) => quad.object.value);
      expect(crusts).toEqual([ex("thickCrust").value]);
    });
  },
};
