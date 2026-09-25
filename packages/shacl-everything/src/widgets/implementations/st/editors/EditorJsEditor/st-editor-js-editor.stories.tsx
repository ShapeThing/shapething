import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment, type SubmitResult } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { ed, rdf, schema } from "@/helpers/namespaces.ts";
import type { Quad_Subject } from "@rdfjs/types";
import { readOutputData } from "./outputData.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:EditorJsEditor is a ShapeThing-original editor (ported from shacl-renderer's own
// EditorJsEditor), not part of the SHACL 1.2 Core spec or the shui: extension proposal. It edits
// a block-based Editor.js document stored as a nested ed:OutputData node (see outputData.ts), and
// is auto-selected for any property declaring sh:class ed:OutputData (see score.ttl) - the
// fixture's shape declares no shui:editor at all.
export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:EditorJsEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stEditorJsEditor: Story = {
  name: "An existing document with a header, paragraph and list",
  args: { ...argsByTestFile("st-editor-js-editor.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    // Every block of the stored document is rendered by its own Editor.js tool.
    const heading = await canvas.findByText("A heading", {}, { timeout: 5000 });
    expect(heading.tagName).toBe("H2");
    await canvas.findByText("First item");
    await canvas.findByText("Second item");
    const paragraph = await canvas.findByText("Lorem ipsum dolor sit amet.");

    await userEvent.click(paragraph);
    await userEvent.keyboard("{End} Edited.");

    const submitButton = await canvas.findByRole("button", { name: "Update" });
    await waitFor(
      async () => {
        submitResult = undefined as SubmitResult | undefined;
        await userEvent.click(submitButton);
        if (!submitResult) throw new Error("onSubmit has not fired yet");
        const texts = submitResult.dataGraph
          .getQuads(null, ed("text"))
          .map((quad) => quad.object.value);
        expect(texts).toContain("Lorem ipsum dolor sit amet. Edited.");
      },
      { timeout: 5000 },
    );

    // The rest of the document survives the wholesale rewrite untouched.
    const dataGraph = submitResult!.dataGraph;
    expect(dataGraph.getQuads(null, ed("text")).map((quad) => quad.object.value)).toContain(
      "A heading",
    );
    expect(dataGraph.getQuads(null, ed("level"))[0]?.object.value).toBe("2");
    expect(
      dataGraph
        .getQuads(null, ed("content"))
        .map((quad) => quad.object.value)
        .sort(),
    ).toEqual(["First item", "Second item"]);
  },
};

export const stEditorJsEditorEmpty: Story = {
  name: "A property with no document yet",
  args: {
    ...argsByTestFile("st-editor-js-editor.ttl", import.meta.url),
    focusNode: factory.namedNode(fixtureUrl("st-editor-js-editor.ttl#empty", import.meta.url).href),
    onSubmit,
  },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    // An empty property already renders one empty widget, picked by the shape's sh:class alone
    // (score.ttl) - there is no stored ed:OutputData yet for the data-graph rule to match on.
    const editable = await waitFor(
      () => {
        const element = canvasElement.querySelector<HTMLElement>(
          ".st-editor-js-editor [contenteditable='true']",
        );
        if (!element) throw new Error("Editor.js has not mounted yet");
        return element;
      },
      { timeout: 5000 },
    );
    await userEvent.click(editable);
    await userEvent.keyboard("A first paragraph");

    // The whole fixture (including <#data>'s own document) is in dataGraph - only read the
    // document linked from this focus node.
    const focusNode = factory.namedNode(
      fixtureUrl("st-editor-js-editor.ttl#empty", import.meta.url).href,
    );
    const submitButton = await canvas.findByRole("button", { name: "Update" });
    await waitFor(
      async () => {
        submitResult = undefined as SubmitResult | undefined;
        await userEvent.click(submitButton);
        if (!submitResult) throw new Error("onSubmit has not fired yet");
        const [link] = submitResult.dataGraph.getQuads(focusNode, schema("articleBody"));
        if (!link) throw new Error("no document linked yet");
        const document = readOutputData(submitResult.dataGraph, link.object as Quad_Subject);
        expect(document?.blocks.map((block) => block.data.text)).toEqual(["A first paragraph"]);
        // Typed ed:OutputData, so from now on it's also picked by value (see score.ttl).
        expect(
          submitResult.dataGraph.getQuads(link.object, rdf("type"), ed("OutputData")),
        ).toHaveLength(1);
      },
      { timeout: 5000 },
    );
  },
};
