import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { ex, schema } from "@/helpers/namespaces.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import type { WidgetProps, Widgets } from "@/widgets/types.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableDefaultValuesInViewMode: a property the data states no value for shows its
// sh:defaultValue in view mode, instead of being left out. The use case: a portrait that falls
// back to the person's initials. The portrait property's default is a marker (ex:Initials), and a
// custom viewer draws the initials for the marker - reading the name from the focus node itself -
// and the image for any other value.
export default {
  title: "Environment/enableDefaultValuesInViewMode",
  component: ShaclRenderer,
};

const INITIALS = ex("Initials");

function PortraitViewer(props: WidgetProps) {
  const { shape, term } = props;
  if (!term.equals(INITIALS)) {
    const ImageViewer = defaultWidgets.viewers.ImageViewer.Component;
    return <ImageViewer {...props} />;
  }
  const name = shape.dataGraph.getQuads(shape.focusNode, schema("name"))[0]?.object.value ?? "";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("");
  return (
    <span
      className="portrait-initials"
      aria-hidden="true"
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "hsl(200 45% 45%)",
        color: "white",
        fontWeight: 600,
      }}
    >
      {initials}
    </span>
  );
}

// A story-only viewer, passed through Environment.widgets - kept out of widgets/implementations/,
// which registry.ts would glob-register into the library itself.
const widgets: Widgets = {
  ...defaultWidgets,
  viewers: {
    ...defaultWidgets.viewers,
    PortraitViewer: { widget: ex("PortraitViewer"), Component: PortraitViewer },
  },
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:PortraitViewer a shui:Widget .
  ex:shape a sh:NodeShape ;
    sh:property [
      sh:name "Portrait"@en ; sh:path schema:image ; sh:order 0 ; sh:maxCount 1 ;
      sh:nodeKind sh:IRI ; shui:viewer ex:PortraitViewer ; sh:defaultValue ex:Initials ;
    ] ;
    sh:property [ sh:name "Name"@en ; sh:path schema:name ; sh:order 1 ] .
`;

// A data URL, so the story doesn't depend on the network.
const image = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="tan"/></svg>',
)}`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:ada schema:name "Ada Lovelace" ; schema:image <${image}> .
  ex:alan schema:name "Alan Turing" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  mode: "view" as const,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  enableDefaultValuesInViewMode: true,
};

const render = (storyArgs: ShaclRendererProps) => (
  <ShaclRenderer {...storyArgs} widgets={widgets} />
);

const portraitOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-widget="PortraitViewer"]');

export const withImage: Story = {
  name: "A value in the data: the viewer shows it, not the default",
  render,
  args: { ...baseArgs, focusNode: ex("ada") } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(portraitOf(canvasElement)?.querySelector("img")).toBeTruthy(), {
      timeout: 5000,
    });
    expect(canvasElement.querySelector("[data-default]")).toBeNull();
  },
};

export const withoutImage: Story = {
  name: "No value in the data: the viewer gets the default, and shows the initials",
  render,
  args: { ...baseArgs, focusNode: ex("alan") } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(portraitOf(canvasElement)?.querySelector(".portrait-initials")).toHaveTextContent(
          "AT",
        ),
      { timeout: 5000 },
    );
    // Marked as a default, so it can be told apart from (and styled differently than) data.
    expect(portraitOf(canvasElement)?.closest("[data-default]")).toBeTruthy();
  },
};

export const disabled: Story = {
  name: "Off (the default): a property without a value is left out",
  render,
  args: {
    ...baseArgs,
    focusNode: ex("alan"),
    enableDefaultValuesInViewMode: false,
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement).toHaveTextContent("Alan Turing"), { timeout: 5000 });
    expect(portraitOf(canvasElement)).toBeNull();
  },
};
