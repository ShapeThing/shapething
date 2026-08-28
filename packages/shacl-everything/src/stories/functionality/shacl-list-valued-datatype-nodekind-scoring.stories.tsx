import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { shui } from "@/helpers/namespaces.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/SHACL list-valued sh:datatype and sh:nodeKind",
  component: ShaclRenderer,
};

// SHACL 1.2 lets sh:datatype/sh:nodeKind hold either a plain IRI or a SHACL list of IRIs (spec
// issue #1179 - https://github.com/w3c/shacl/issues/1179). scoring/widget-scoring.ttl's meta-shapes
// (hasDatatypeStringConstraint, hasNodeKindIRIConstraint, etc.) walk that list via
// `sh:path ( sh:datatype [ sh:zeroOrMorePath rdf:rest ] rdf:first )`, so a property whose shape
// accepts several datatypes/node kinds still offers a widget candidate for each of them - not just
// the one the meta-shapes happened to see before that fix (the list's own head blank node).
async function findWidgetInput(canvasElement: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => {
    const element = canvasElement.querySelector<HTMLElement>(
      ".st-property-object__widget :is(input, select)",
    );
    if (!element) throw new Error("expected an active widget input to render");
    return element;
  });
}

async function openWidgetSwitcher(canvasElement: HTMLElement): Promise<void> {
  const input = await findWidgetInput(canvasElement);
  input.focus();

  const trigger = await waitFor(() => {
    const button = canvasElement.querySelector<HTMLButtonElement>(
      ".st-widget-switcher .st-listbox__trigger",
    );
    if (!button) throw new Error("widget switcher trigger not shown yet");
    return button;
  });
  await userEvent.click(trigger);
}

function hasWidgetOption(canvasElement: HTMLElement, widgetIri: string): boolean {
  return !!canvasElement.querySelector(
    `.st-widget-switcher [role='option'][data-value="${widgetIri}"]`,
  );
}

// shacl-engine's own sh:datatype/sh:nodeKind constraint components weren't list-aware either (a
// separate, deeper gap than the widget-scoring fix above - see
// [[shacl_everything_shacl_engine_path_limits]]): live-validating a real value against a
// list-valued sh:datatype silently misreported it as a violation, and against a list-valued
// sh:nodeKind it crashed validation outright. Both stories below now assert the value renders with
// no violation shown, proving that gap is fixed too (as of the shacl-engine dependency switching to
// rdf-ext/shacl-engine's `experimental` branch, which is genuinely SHACL-1.2-list-aware).
function hasViolation(canvasElement: HTMLElement): boolean {
  return !!canvasElement.querySelector('.st-property-object[data-severity="Violation"]');
}

export const listValuedDatatype: Story = {
  name: "sh:datatype ( xsd:integer xsd:string ) offers both a Number Field and a Text Field candidate",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix ex: <http://example.org/> .
      ex:shape a sh:NodeShape ;
        sh:targetNode ex:data ;
        sh:property [
          sh:name "Quantity"@en ;
          sh:path ex:quantity ;
          sh:datatype ( xsd:integer xsd:string ) ;
        ] .
    `,
    dataGraph: `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      ex:data ex:quantity "5"^^xsd:integer .
    `,
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/data"),
    enableWidgetSwitching: true,
  },
  play: async ({ canvasElement }) => {
    await openWidgetSwitcher(canvasElement);
    expect(hasWidgetOption(canvasElement, shui("NumberFieldEditor").value)).toBe(true);
    expect(hasWidgetOption(canvasElement, shui("TextFieldEditor").value)).toBe(true);
    expect(hasViolation(canvasElement)).toBe(false);
  },
};

export const listValuedNodeKind: Story = {
  name: "sh:nodeKind ( sh:IRI sh:Literal ) offers both a URI Field and a Text Field candidate",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      ex:shape a sh:NodeShape ;
        sh:targetNode ex:data ;
        sh:property [
          sh:name "Reference"@en ;
          sh:path ex:reference ;
          sh:nodeKind ( sh:IRI sh:Literal ) ;
        ] .
    `,
    dataGraph: `
      @prefix ex: <http://example.org/> .
      ex:data ex:reference "unresolved" .
    `,
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/data"),
    enableWidgetSwitching: true,
  },
  play: async ({ canvasElement }) => {
    await openWidgetSwitcher(canvasElement);
    expect(hasWidgetOption(canvasElement, shui("IRIEditor").value)).toBe(true);
    expect(hasWidgetOption(canvasElement, shui("TextFieldEditor").value)).toBe(true);
    expect(hasViolation(canvasElement)).toBe(false);
  },
};
