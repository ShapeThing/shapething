import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// A property-level sh:or value's branch and widget are resolved together (see
// hooks/useSlotResolution.tsx): the widget rendered is always the one for the value's detected
// branch - never the unbranched property's own widget first, swapped out once branch detection
// catches up - and switching branches re-resolves both.
export default {
  title: "Tests/Interaction/Property-level sh:or widget resolution",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:property [
      sh:name "Flag"@en ;
      sh:path ex:flag ;
      sh:or (
        [ sh:name "As text"@en ; sh:datatype xsd:string ]
        [ sh:name "As yes/no"@en ; sh:datatype xsd:boolean ]
      ) ;
    ] .
`;
const dataGraph = `
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix ex: <http://example.org/> .
  ex:data ex:flag true .
`;

export const branchAndWidgetResolveTogether: Story = {
  name: "A boolean value renders its branch's BooleanEditor straight away, and follows a branch switch",
  args: {
    shapesGraph,
    dataGraph,
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/data"),
    enableLogicalBranchSwitching: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every widget this value's slot ever mounts, from before the first one resolves.
    const seen: string[] = [];
    const record = () => {
      for (const element of canvasElement.querySelectorAll<HTMLElement>("[data-widget]")) {
        const widget = element.dataset.widget!;
        if (seen.at(-1) !== widget) seen.push(widget);
      }
    };
    const observer = new MutationObserver(record);
    observer.observe(canvasElement, { subtree: true, childList: true, attributes: true });
    record();

    const slot = await waitFor(
      () => {
        const element = canvasElement.querySelector<HTMLElement>(".st-property-object__widget");
        if (!element) throw new Error("expected the value's widget to render");
        return element;
      },
      { timeout: 5000 },
    );
    await waitFor(() => expect(slot.dataset.widget).toBe("BooleanEditor"));
    expect(seen).toEqual(["BooleanEditor"]);

    // Switch to the string branch via the fly-out's LogicalConstraintSwitcher.
    slot.querySelector<HTMLElement>("input, button, select")!.focus();
    const trigger = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-logical-constraint-switcher .st-select",
      );
      if (!element) throw new Error("expected the branch switcher's trigger to render");
      return element;
    });
    await userEvent.click(trigger);
    await userEvent.click(await canvas.findByRole("option", { name: "As text" }));

    await waitFor(() =>
      expect(
        canvasElement.querySelector<HTMLElement>(".st-property-object__widget")?.dataset.widget,
      ).toBe("TextFieldEditor"),
    );
    observer.disconnect();
  },
};
