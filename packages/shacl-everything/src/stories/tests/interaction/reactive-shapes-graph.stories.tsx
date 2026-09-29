import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { RdfStore } from "rdf-stores";
import ShaclRenderer from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";
import { makeReactive, transact } from "@/helpers/reactiveRdfStore.ts";
import { resolveRdfSource } from "@/preprocess/resolveRdfSources.ts";
import type { RdfSource } from "@/types/RdfSource.ts";

const args = argsByTestFile("reactive-shapes-graph.ttl", import.meta.url);
const sh = (name: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${name}`);
const xsd = (name: string) => factory.namedNode(`http://www.w3.org/2001/XMLSchema#${name}`);
const lastRestored = factory.namedNode(`${(args.shapesGraph as URL).href.split("#")[0]}#lastRestored`);

// Built fresh per story render (a loader) and kept module-level rather than passed as an arg -
// Storybook must never try to serialise a raw RdfStore (see shacl_everything_storybook_arg_display).
let shapesGraph: RdfStore;

export default {
  title: "Tests/Interaction/Reactive shapesGraph",
  loaders: [
    async () => {
      shapesGraph = makeReactive(
        await resolveRdfSource(args.shapesGraph as RdfSource, new Map(), undefined),
      );
      return {};
    },
  ],
  render: () => <ShaclRenderer {...args} shapesGraph={shapesGraph} mode="edit" />,
};

type Story = StoryObj;

// A write to a reactive shapesGraph re-preprocesses in place: the form follows the new shape
// without ever falling back to "Loading", and an unsubmitted edit in it survives.
export const shapeWritesUpdateInPlace: Story = {
  name: "Writing to a reactive shapesGraph updates the form in place",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inventoryNumber = await canvas.findByDisplayValue("SK-A-2344", {}, { timeout: 15000 });

    let reloaded = false;
    const loadingObserver = new MutationObserver(() => {
      if (canvasElement.querySelector(".st-environment-context-provider__loading")) reloaded = true;
    });
    loadingObserver.observe(canvasElement, { childList: true, subtree: true });

    await userEvent.clear(inventoryNumber);
    await userEvent.type(inventoryNumber, "SK-A-2344-bis");
    await userEvent.tab();

    expect(canvasElement.querySelector('input[type="date"]')).toBeNull();
    transact(shapesGraph, () => {
      shapesGraph.removeQuad(factory.quad(lastRestored, sh("datatype"), xsd("string")));
      shapesGraph.addQuad(factory.quad(lastRestored, sh("datatype"), xsd("date")));
      shapesGraph.addQuad(factory.quad(lastRestored, sh("minCount"), factory.literal("1", xsd("integer"))));
    });

    await waitFor(
      () => {
        expect(canvasElement.querySelector('input[type="date"]')).not.toBeNull();
        expect(canvas.getAllByLabelText("Required")).toHaveLength(1);
      },
      { timeout: 15000 },
    );

    loadingObserver.disconnect();
    expect(reloaded).toBe(false);
    expect(canvas.getByDisplayValue("SK-A-2344-bis")).toBeVisible();
  },
};
