import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import type { Widgets } from "@/widgets/types.ts";

type Story = StoryObj<ShaclRendererProps>;

// A widget that throws while rendering is contained by WidgetSlot's own per-value error boundary
// (components/WidgetErrorBoundary) - it's replaced by a small inline error, and every other field
// (and the form itself) keeps working, instead of the root boundary in render.tsx unmounting the
// whole form.
export default {
  title: "Tests/Interaction/Widget error boundary",
  component: ShaclRenderer,
};

function ThrowingEditor(): never {
  throw new Error("ThrowingEditor always fails to render");
}

// A test-only widget, passed through Environment.widgets (spread over defaultWidgets, so every
// other field still resolves its normal widget) and picked for one property via an explicit
// shui:editor - kept out of widgets/implementations/, which registry.ts would glob-register into
// the library itself.
const THROWING_EDITOR = "http://example.org/test/ThrowingEditor";
const widgets: Widgets = {
  ...defaultWidgets,
  editors: {
    ...defaultWidgets.editors,
    ThrowingEditor: { widget: factory.namedNode(THROWING_EDITOR), Component: ThrowingEditor },
  },
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:property [
      sh:name "Name"@en ; sh:path ex:name ; sh:datatype xsd:string ; sh:order 0 ;
    ] ;
    sh:property [
      sh:name "Broken"@en ; sh:path ex:broken ; sh:datatype xsd:string ; sh:order 1 ;
      shui:editor <${THROWING_EDITOR}> ;
    ] .
`;
const dataGraph = `
  @prefix ex: <http://example.org/> .
  ex:data ex:name "Hendrik" ; ex:broken "boom" .
`;

export const aThrowingWidgetOnlyReplacesItself: Story = {
  name: "A widget that throws renders an inline error; sibling fields keep working",
  render: (storyArgs) => <ShaclRenderer {...storyArgs} widgets={widgets} />,
  args: {
    shapesGraph,
    dataGraph,
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/data"),
    enableWidgetSwitching: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const error = await canvas.findByRole("alert", {}, { timeout: 5000 });
    expect(error).toHaveTextContent("This field could not be displayed.");
    expect(error.closest(".st-property-object__widget")?.getAttribute("data-widget")).toBe(
      "ThrowingEditor",
    );

    // The rest of the form is still mounted and editable.
    expect(canvas.getByRole("button", { name: "Update" })).toBeTruthy();
    const nameInput = canvasElement.querySelector<HTMLInputElement>(
      '[data-widget="TextFieldEditor"] input',
    )!;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Henk");
    await expect(nameInput).toHaveValue("Henk");

    // The inline error is focusable, which opens the slot's fly-out - picking a different widget
    // there resets the boundary.
    error.focus();
    const trigger = await waitFor(() => {
      const element = error
        .closest(".st-property-object__widget")
        ?.querySelector<HTMLElement>(".st-widget-switcher .st-select");
      if (!element) throw new Error("expected the widget switcher to render");
      return element;
    });
    await userEvent.click(trigger);
    await userEvent.click(await canvas.findByRole("option", { name: /^Text Field \(/ }));

    await waitFor(() => expect(canvas.queryByRole("alert")).toBeNull());
    expect(
      canvasElement.querySelectorAll<HTMLInputElement>('[data-widget="TextFieldEditor"] input'),
    ).toHaveLength(2);
  },
};
