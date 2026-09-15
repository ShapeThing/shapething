import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { ex, st } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:ColorEditor is a ShapeThing-original editor, not part of the SHACL 1.2 Core spec or the shui:
// extension proposal - it lives in its own stories folder rather than alongside the spec-
// conformance suite, colocated with its implementation (see widget.tsx). Its value convention is a
// blank node carrying three plain xsd:decimal triples - st:hue/st:saturation/st:lightness, genuine
// CSS HSL notation (see helpers/colorBuckets.ts's Hsl type) - rather than a hex string; the swatch
// and hex text field both convert to/from hex only at the UI edge (helpers/colorBuckets.ts's
// hexToHsl/hslToHex).
export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:ColorEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stColorEditor: Story = {
  name: "An already-selected color value",
  args: { ...argsByTestFile("st-color-editor.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    // The fixture's stored HSL (h=217.22, s=91.22, l=59.80) round-trips back to the original hex
    // via helpers/colorBuckets.ts's hslToHex - the swatch/text field never store hex themselves.
    // Both the swatch (<input type=color>) and the text field show it, so query the text field
    // specifically by its own class rather than an ambiguous shared display value.
    await waitFor(() =>
      expect(canvasElement.querySelector<HTMLInputElement>(".st-color-editor__hex")?.value).toBe(
        "#3b82f6",
      ),
    );
    const hexInput = canvasElement.querySelector<HTMLInputElement>(".st-color-editor__hex")!;

    await userEvent.clear(hexInput);
    await userEvent.type(hexInput, "#dc2626");
    await userEvent.click(canvas.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const node = submitResult.dataGraph.getQuads(null, ex("favoriteColor"))[0]?.object;
      if (!node) throw new Error("favoriteColor has no value yet");
      // #dc2626's own HSL components (helpers/colorBuckets.ts's hexToHsl) - proves the text
      // field's edited hex was actually converted and written as st:hue/st:saturation/
      // st:lightness on the property's own blank node, not left as a hex string anywhere.
      expect(submitResult.dataGraph.getQuads(node, st("hue"))[0]?.object.value).toEqual("0");
      expect(submitResult.dataGraph.getQuads(node, st("saturation"))[0]?.object.value).toEqual(
        "72.22222222222223",
      );
      expect(submitResult.dataGraph.getQuads(node, st("lightness"))[0]?.object.value).toEqual(
        "50.588235294117645",
      );
    });
  },
};
