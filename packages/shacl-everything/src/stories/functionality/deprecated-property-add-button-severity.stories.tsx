import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/Add button severity",
  component: ShaclRenderer,
};

// A deprecated field, modeled as two property shapes grouped onto the same sh:path
// (propertiesForShape merges every shape sharing a path into one PropertyUIElement): one closes
// the field off going forward (sh:maxCount 0 - carrying the severity that matters here), the
// other still governs the legacy values already in the wild (sh:pattern), so old data keeps
// validating on its own terms even though nothing new may be added through the UI. At the
// maxCount-0 shape's default/explicit sh:Violation severity, the add button isn't rendered at all
// (maxCount is a hard rule there). A Warning or Info severity instead renders it colored - still
// subject to the same disabled-while-an-empty-widget-is-open rule as any other field, since those
// are advisory rather than a hard rule.
function shapesAndData(severityTurtle: string, existingLegacyId?: string): string {
  return `
@prefix schema: <http://schema.org/>.
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix ex: <http://example.org/>.

ex:shape
    a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property
      [
        sh:name "Legacy ID"@en ;
        sh:path ex:legacyId ;
        sh:maxCount 0 ;
        ${severityTurtle}
        sh:message "This field is deprecated - do not add new legacy IDs."@en ;
      ],
      [
        sh:path ex:legacyId ;
        sh:datatype xsd:string ;
        sh:pattern "^LEG-[0-9]{4}$" ;
      ]
    .

ex:data
    a schema:Product ;
    ${existingLegacyId ? `ex:legacyId "${existingLegacyId}" ;` : ""}
    .
`;
}

function args(severityTurtle: string, existingLegacyId?: string): ShaclRendererProps {
  const turtle = shapesAndData(severityTurtle, existingLegacyId);
  return {
    shapesGraph: turtle,
    dataGraph: turtle,
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/data"),
  };
}

async function findAddButton(canvasElement: HTMLElement): Promise<HTMLButtonElement> {
  return waitFor(() => {
    const button = within(canvasElement).getByRole("button", { name: "Add value" });
    return button as HTMLButtonElement;
  });
}

// PropertyUIComponentValues has no legacy value to show yet, so it renders its own empty,
// directly-editable widget (its showEmptyWidget state, seeded from
// languageFilteredObjects.length === 0) - use that as the settle point before asserting on the
// add button next to it.
async function findEmptyLegacyWidget(canvasElement: HTMLElement): Promise<void> {
  await within(canvasElement).findByRole("textbox", {}, { timeout: 5000 });
}

export const warningEmpty: Story = {
  name: "sh:Warning colors the empty-state add button orange, but it stays disabled",
  args: args("sh:severity sh:Warning ;"),
  play: async ({ canvasElement }) => {
    await findEmptyLegacyWidget(canvasElement);
    const button = await findAddButton(canvasElement);
    // The empty widget already open next to it is itself a place to add a value, so the button
    // stays disabled here the same as it would for any other field - only its color communicates
    // the severity ahead of time.
    expect(button).toBeDisabled();
    expect(button).toHaveClass("st-button--severity", "severity-warning");
  },
};

// sh:Violation is a hard rule, so the add button isn't rendered at all - unlike Warning/Info,
// there's nothing here to preview since it can never be clicked.
export const violationEmpty: Story = {
  name: "sh:Violation hides the empty-state add button entirely",
  args: args("sh:severity sh:Violation ;"),
  play: async ({ canvasElement }) => {
    await findEmptyLegacyWidget(canvasElement);
    expect(within(canvasElement).queryByRole("button", { name: "Add value" })).toBeNull();
  },
};

export const infoEmpty: Story = {
  name: "sh:Info colors the empty-state add button blue, but it stays disabled",
  args: args("sh:severity sh:Info ;"),
  play: async ({ canvasElement }) => {
    await findEmptyLegacyWidget(canvasElement);
    const button = await findAddButton(canvasElement);
    // See warningEmpty above - the already-open empty widget is where a value would go, so the
    // button stays disabled; only its color communicates the severity ahead of time.
    expect(button).toBeDisabled();
    expect(button).toHaveClass("st-button--severity", "severity-info");
  },
};

async function findExistingLegacyValue(canvasElement: HTMLElement): Promise<void> {
  // The existing legacy value renders and validates fine on its own (it matches sh:pattern) -
  // only adding another one is what sh:maxCount 0 objects to.
  await within(canvasElement).findByDisplayValue("LEG-1234", {}, { timeout: 5000 });
}

// A legacy value already on the record means there's no auto-shown empty widget this time (see
// PropertyUIComponentValues) - the add button is now the only way to add a second value, so this
// is where sh:maxCount 0's severity actually decides whether that's allowed.
export const warningWithExistingLegacyValue: Story = {
  name: "sh:Warning with an existing legacy value: colored orange, still clickable",
  args: args("sh:severity sh:Warning ;", "LEG-1234"),
  play: async ({ canvasElement }) => {
    await findExistingLegacyValue(canvasElement);
    const button = await findAddButton(canvasElement);
    expect(button).toBeEnabled();
    expect(button).toHaveClass("st-button--severity", "severity-warning");
  },
};

export const infoWithExistingLegacyValue: Story = {
  name: "sh:Info with an existing legacy value: colored blue, still clickable",
  args: args("sh:severity sh:Info ;", "LEG-1234"),
  play: async ({ canvasElement }) => {
    await findExistingLegacyValue(canvasElement);
    const button = await findAddButton(canvasElement);
    expect(button).toBeEnabled();
    expect(button).toHaveClass("st-button--severity", "severity-info");
  },
};

export const violationWithExistingLegacyValue: Story = {
  name: "sh:Violation with an existing legacy value: add button hidden entirely",
  args: args("sh:severity sh:Violation ;", "LEG-1234"),
  play: async ({ canvasElement }) => {
    await findExistingLegacyValue(canvasElement);
    expect(within(canvasElement).queryByRole("button", { name: "Add value" })).toBeNull();
  },
};
