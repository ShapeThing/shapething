import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import type { WidgetProps, Widgets } from "@/widgets/types.ts";

type Story = StoryObj<ShaclRendererProps>;

// Render-cost regression coverage for WidgetSlot: moving focus from one value to the next must only
// re-render the slots whose own focus state actually changed (see hooks/useActiveElement.tsx's
// shared focus store), not every value slot in the form. Measured through a test-only widget that
// counts its own renders - a widget re-renders whenever its WidgetSlot does (neither is memoized),
// so this is a direct proxy for "how many slots re-rendered".
export default {
  title: "Tests/Interaction/Value slot render isolation",
  component: ShaclRenderer,
};

const renderCounts = new Map<string, number>();

// Counted per slot by the value's first letter, so an edit ("a" -> "a2") keeps counting against
// the same slot.
function CountingEditor({ term, setTerm, labelledBy }: WidgetProps) {
  const slot = term.value[0];
  renderCounts.set(slot, (renderCounts.get(slot) ?? 0) + 1);
  return (
    <input
      className="st-input"
      data-counting-editor={slot}
      aria-labelledby={labelledBy}
      defaultValue={term.value}
      onBlur={(event) => {
        if (event.target.value !== term.value) setTerm(factory.literal(event.target.value));
      }}
    />
  );
}

// Registered under its own IRI and only ever selected via an explicit shui:editor on the shape -
// passed straight through Environment.widgets (spread over defaultWidgets so every other property
// type still resolves normally) rather than living under widgets/implementations/, which
// registry.ts would otherwise glob-register into the library itself.
const COUNTING_EDITOR = "http://example.org/test/CountingEditor";
const widgets: Widgets = {
  ...defaultWidgets,
  editors: {
    ...defaultWidgets.editors,
    CountingEditor: { widget: factory.namedNode(COUNTING_EDITOR), Component: CountingEditor },
  },
};

const letters = ["a", "b", "c", "d", "e", "f"];

async function findInputs(canvasElement: HTMLElement): Promise<HTMLInputElement[]> {
  return waitFor(() => {
    const found = canvasElement.querySelectorAll<HTMLInputElement>("[data-counting-editor]");
    if (found.length !== letters.length) throw new Error("expected every value's widget");
    return [...found];
  });
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function rendersSince(before: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    letters.map((letter) => [letter, (renderCounts.get(letter) ?? 0) - (before.get(letter) ?? 0)]),
  );
}

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    ${letters
      .map(
        (letter, index) =>
          `sh:property [ sh:name "${letter}"@en ; sh:path ex:${letter} ; sh:order ${index} ; shui:editor <${COUNTING_EDITOR}>${
            // Only "a" can become invalid - see the revalidation story below.
            letter === "a" ? ` ; sh:maxLength 1 ; sh:message "too long"@en` : ""
          } ]`,
      )
      .join(" ;\n    ")} .
`;
const dataGraph = `
  @prefix ex: <http://example.org/> .
  ex:data ${letters.map((letter) => `ex:${letter} "${letter}"`).join(" ; ")} .
`;

const args = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
  // Keeps the fly-out itself out of the picture - this is about which slots re-render, not about
  // what they render once focused.
  enableWidgetSwitching: false,
  enableLogicalBranchSwitching: false,
};

export const movingFocusOnlyRerendersTheSlotsWhoseFocusChanged: Story = {
  name: "Moving focus between two values doesn't re-render the other values' slots",
  render: (storyArgs) => <ShaclRenderer {...storyArgs} widgets={widgets} />,
  args,
  play: async ({ canvasElement }) => {
    const inputs = await findInputs(canvasElement);

    inputs[0].focus();
    // Let the initial mount/validation/focus renders settle before taking the baseline.
    await settle(500);
    const before = new Map(renderCounts);

    // A direct focus() rather than userEvent.tab(): Tab from "a" would land on its own remove
    // button first, not on "b" - the focus move itself is what's being measured either way.
    inputs[1].focus();
    await waitFor(() => expect(document.activeElement).toBe(inputs[1]));
    await settle(100);

    const delta = rendersSince(before);
    console.info("[slot-render-isolation] renders per slot for one focus move:", delta);

    // Only "a" (lost focus) and "b" (gained it) have a different focus answer - every other slot
    // must stay untouched.
    for (const letter of letters.slice(2)) expect(delta[letter]).toBe(0);
  },
};

export const revalidationOnlyRerendersTheSlotsWhoseResultsChanged: Story = {
  name: "A revalidation run only re-renders the value whose own validation results changed",
  render: (storyArgs) => <ShaclRenderer {...storyArgs} widgets={widgets} />,
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inputs = await findInputs(canvasElement);
    // Unlocks validation display (see usePropertyValidationResults) - everything is valid so far.
    await userEvent.click(await canvas.findByRole("button", { name: "Update" }));
    await settle(500);
    expect(canvasElement.querySelector(".st-validation-message")).toBeNull();

    // Editing "a" past its sh:maxLength writes to dataGraph, which schedules a (debounced, 200ms)
    // revalidation run. The baseline is taken after the write's own re-render of "a" but before
    // the run lands, so only the run's own renders are counted.
    inputs[0].focus();
    await userEvent.type(inputs[0], "2");
    inputs[0].blur();
    await settle(50);
    const before = new Map(renderCounts);

    await waitFor(() => {
      const message = canvasElement.querySelector(".st-validation-message");
      expect(message?.textContent).toContain("too long");
    });
    await settle(100);
    const delta = rendersSince(before);
    console.info("[slot-render-isolation] renders per slot for one revalidation run:", delta);

    // The new violation belongs to "a" alone - only its slot re-renders to show it.
    expect(delta.a).toBeGreaterThan(0);
    for (const letter of letters.slice(1)) expect(delta[letter]).toBe(0);
    expect(canvasElement.querySelectorAll(".st-validation-message")).toHaveLength(1);

    // Fixing the value clears the message again.
    const fixed = canvasElement.querySelector<HTMLInputElement>('[data-counting-editor="a"]')!;
    await userEvent.clear(fixed);
    await userEvent.type(fixed, "a");
    fixed.blur();
    await waitFor(() => expect(canvasElement.querySelector(".st-validation-message")).toBeNull());
  },
};

export const writingOneValueOnlyRerendersThatSlot: Story = {
  name: "Writing one value doesn't re-render the other values' slots (no sh:targetWhere)",
  render: (storyArgs) => <ShaclRenderer {...storyArgs} widgets={widgets} />,
  args,
  play: async ({ canvasElement }) => {
    const inputs = await findInputs(canvasElement);
    await settle(500);
    const before = new Map(renderCounts);

    // "b" has no constraints, so the write's revalidation run changes no results either - the
    // settle covers its 200ms debounce so any render it caused would be counted.
    inputs[1].focus();
    await userEvent.type(inputs[1], "2");
    inputs[1].blur();
    await settle(500);

    const delta = rendersSince(before);
    console.info("[slot-render-isolation] renders per slot for one write:", delta);

    // This shapes graph has no sh:targetWhere, so useTargetWhereFragments must not re-render the
    // whole node (and every slot with it) from NodeUIComponent down on a write to ex:data.
    expect(delta.b).toBeGreaterThan(0);
    for (const letter of letters.filter((letter) => letter !== "b")) expect(delta[letter]).toBe(0);
  },
};
