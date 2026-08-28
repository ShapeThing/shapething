import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/Submitting the edit form",
  component: ShaclRenderer,
};

const shapesAndData = `
@prefix ex: <http://example.org/>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix schema: <http://schema.org/>.
@prefix sh: <http://www.w3.org/ns/shacl#>.

ex:shape
    a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:name "Given name"@en ;
        sh:path schema:givenName ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    .

ex:data
    a schema:Person ;
    schema:givenName "Hendrik" ;
    .
`;

// Every story already gets a turtle log of its submission in the Actions panel for free (see
// withSubmitPreview.tsx), so this doesn't need its own preview UI - just something for play() to
// assert the submitted result against. A plain closure rather than storybook/test's fn(): fn()
// mocks are themselves auto-logged to the Actions panel when called, and Storybook tries to
// serialise the raw call argument for that log - a plain RdfStore has a real internal cycle
// (same issue friendlyArgDisplay in preview.tsx works around for Controls) and crashes that
// serialisation before this callback even gets to see it.
let submittedResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submittedResult = result;
};

export const submittingHandsBackTheDataGraphAsANewStore: Story = {
  name: "Submitting the form hands back the data graph's quads in a fresh store",
  args: {
    shapesGraph: shapesAndData,
    dataGraph: shapesAndData,
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/data"),
    onSubmit,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    submittedResult = undefined;

    // ex:data already has a schema:givenName, so the button reads "Update" (see EditModeWrapper's
    // hasTriples check) rather than "Create".
    const submitButton = await canvas.findByRole("button", { name: "Update" }, { timeout: 5000 });
    await userEvent.click(submitButton);

    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });

    // A fresh store, not the live dataGraph itself - reactive Environment.dataGraph would report
    // a different constructor (see makeReactive's Proxy in reactiveRdfStore.ts).
    expect(
      result.dataGraph
        .getQuads(
          factory.namedNode("http://example.org/data"),
          factory.namedNode("http://schema.org/givenName"),
        )
        .map((quad) => quad.object.value),
    ).toEqual(["Hendrik"]);

    // Nothing changed - no additions, no deletions.
    expect(result.additions).toEqual([]);
    expect(result.deletions).toEqual([]);
  },
};
