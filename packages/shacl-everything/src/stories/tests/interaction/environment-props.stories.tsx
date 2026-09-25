import { useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// ShaclRenderer's identity vs live props (see outputs/render/environmentProps.ts), the imported-
// vocabulary exclusion from SubmitResult.dataGraph, and undo/redo scoping across several forms.
export default {
  title: "Tests/Interaction/Environment props",
  component: ShaclRenderer,
};

const args = argsByTestFile("environment-props.ttl", import.meta.url);
const otherFocusNode = factory.namedNode(
  fixtureUrl("environment-props.ttl#other", import.meta.url).href,
);

const input = (root: ParentNode) =>
  root.querySelector<HTMLInputElement>('[data-widget="TextFieldEditor"] input');

const calls: string[] = [];
let lastResult: SubmitResult | undefined;

// Re-renders ShaclRenderer with a fresh inline onSubmit (closing over a counter) and a toggled
// live flag, then switches focusNode (an identity prop).
function Harness() {
  const [round, setRound] = useState(1);
  const [focusOther, setFocusOther] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setRound((value) => value + 1)}>
        next round
      </button>
      <button type="button" onClick={() => setFocusOther(true)}>
        other focus node
      </button>
      <ShaclRenderer
        {...args}
        focusNode={focusOther ? otherFocusNode : args.focusNode}
        enableWidgetSwitching={round % 2 === 0}
        onSubmit={(result) => {
          calls.push(`round ${round}`);
          lastResult = result;
        }}
      />
    </>
  );
}

export const livePropsKeepTheSessionIdentityPropsRebuildIt: Story = {
  name: "A new inline onSubmit or live flag keeps the edit session; a new focusNode rebuilds it",
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    calls.length = 0;
    const field = await waitFor(() => {
      const found = input(canvasElement);
      expect(found?.value).toBe("Hendrik");
      return found!;
    });

    // An uncommitted-to-submit edit, then parent re-renders with a new onSubmit + flipped flag.
    await userEvent.clear(field);
    await userEvent.type(field, "Klaas");
    await userEvent.tab();
    const nextRound = [...canvasElement.querySelectorAll("button")].find(
      (button) => button.textContent === "next round",
    )!;
    await userEvent.click(nextRound);
    await userEvent.click(nextRound);

    // Same session: the edit survived, and submit calls the *latest* callback.
    expect(input(canvasElement)?.value).toBe("Klaas");
    await userEvent.click(canvasElement.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await waitFor(() => expect(calls).toEqual(["round 3"]));

    // Imported vocabulary (ex:Person rdfs:label) is in dataGraph for label lookups, but not handed
    // back as the embedder's own data.
    const labels = lastResult!.dataGraph.getQuads(
      factory.namedNode("http://example.org/Person"),
      factory.namedNode("http://www.w3.org/2000/01/rdf-schema#label"),
    );
    expect(labels).toHaveLength(0);
    expect(lastResult!.additions.map((quad) => quad.object.value)).toEqual(["Klaas"]);

    // An identity prop change starts a new session on the other resource.
    const other = [...canvasElement.querySelectorAll("button")].find(
      (button) => button.textContent === "other focus node",
    )!;
    await userEvent.click(other);
    await waitFor(() => expect(input(canvasElement)?.value).toBe("Grace"));
  },
};

// Two independent forms on one page - Ctrl+Z belongs to whichever was used last.
export const undoOnlyAffectsTheLastUsedForm: Story = {
  name: "Ctrl+Z only undoes in the form that was used last",
  render: () => (
    <>
      <div data-form="a">
        <ShaclRenderer {...args} />
      </div>
      <div data-form="b">
        <ShaclRenderer {...args} focusNode={otherFocusNode} />
      </div>
    </>
  ),
  play: async ({ canvasElement }) => {
    const formA = canvasElement.querySelector('[data-form="a"]')!;
    const formB = canvasElement.querySelector('[data-form="b"]')!;
    await waitFor(() => {
      expect(input(formA)?.value).toBe("Hendrik");
      expect(input(formB)?.value).toBe("Grace");
    });

    await userEvent.clear(input(formA)!);
    await userEvent.type(input(formA)!, "Klaas");
    await userEvent.tab();
    await userEvent.clear(input(formB)!);
    await userEvent.type(input(formB)!, "Ada");
    await userEvent.tab();

    // Focus is now on form B's submit/remove controls: B was used last.
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(input(formB)?.value).toBe("Grace"));
    expect(input(formA)?.value).toBe("Klaas");

    // Using form A again moves undo there.
    await userEvent.click(formA.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(input(formA)?.value).toBe("Hendrik"));
    expect(input(formB)?.value).toBe("Grace");
  },
};
