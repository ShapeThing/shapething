import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex, rdf } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/Submitting the edit form",
  component: ShaclRenderer,
};

const args = argsByTestFile("submit-target-where.ttl", import.meta.url);

// See submit.stories.tsx's own onSubmit comment for why this is a plain closure, not fn().
let submittedResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submittedResult = result;
};

export const orphanedTargetWhereDataIsDeletedOnSubmit: Story = {
  name: "A sh:targetWhere fragment's data is deleted once its fragment stops matching and the form is submitted",
  args: { ...args, onSubmit },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    submittedResult = undefined;

    // ex:FragmentAShape's own field ("Extra A") is attached and filled in, since ex:kind is "A".
    await expect(canvas.findByDisplayValue("hello")).resolves.toBeVisible();

    // Switch "Kind" from "A" to "B" - FragmentAShape stops conforming, so "Extra A" disappears from
    // the form (useTargetWhereFragments re-evaluating live), leaving ex:extraA "hello" behind in
    // dataGraph, untouched and unreachable from anything currently rendered.
    const trigger = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(".st-enum-select__trigger");
      if (!element) throw new Error("Could not find the Kind select's trigger");
      return element;
    });
    await userEvent.click(trigger);
    const listbox = await canvas.findByRole("listbox");
    await userEvent.click(within(listbox).getByRole("option", { name: "B" }));

    await waitFor(() => expect(canvas.queryByDisplayValue("hello")).toBeNull());

    // "Kind" itself belongs to the always-present base shape, not a fragment - useTargetWhereFragments
    // recalculating (which detaches FragmentAShape and attaches FragmentBShape around it) must not
    // remount it. Before elementKey()-based keying, an index-keyed sibling list could tear down and
    // rebuild everything from the change point onward on any array-length shift; asserting the same
    // DOM node survives the switch is a regression guard against that class of bug reappearing.
    const triggerAfterSwitch = canvasElement.querySelector<HTMLButtonElement>(
      ".st-enum-select__trigger",
    );
    expect(triggerAfterSwitch).toBe(trigger);

    const submitButton = await canvas.findByRole("button", { name: "Update" }, { timeout: 5000 });
    await userEvent.click(submitButton);

    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });

    // The orphaned ex:extraA triple is reported as an actual deletion...
    expect(
      result.deletions.some(
        (quad) => quad.predicate.value === ex("extraA").value && quad.object.value === "hello",
      ),
    ).toBe(true);

    // ...and is genuinely gone from the submitted graph, not just hidden.
    expect(result.dataGraph.getQuads(args.focusNode, ex("extraA"))).toEqual([]);

    // ex:extraListA (sh:memberShape) is also orphaned - not just unlinked from the focus node, but
    // its whole rdf:first/rdf:rest cell chain must be gone too, not left dangling. (dataGraph also
    // legitimately still holds the shapes' own "A"/"B" sh:in rdf:List, since this fixture parses
    // the same file into both shapesGraph and dataGraph - the check below is scoped to this list's
    // own item values, "one"/"two", not "no rdf:first anywhere at all".)
    expect(result.dataGraph.getQuads(args.focusNode, ex("extraListA"))).toEqual([]);
    expect(
      result.dataGraph
        .getQuads(null, rdf("first"))
        .some((quad) => quad.object.value === "one" || quad.object.value === "two"),
    ).toBe(false);
    expect(
      result.deletions.some(
        (quad) => quad.predicate.equals(rdf("first")) && quad.object.value === "one",
      ),
    ).toBe(true);
  },
};
