import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Edit",
  component: ShaclRenderer,
};

const contactUrl = new URL("contact.ttl", import.meta.url);
const johnUrl = new URL("john.ttl", import.meta.url);
const severityUrl = new URL("severity.ttl", import.meta.url);
const datatypeWidgetsUrl = new URL("datatype-widgets.ttl", import.meta.url);

// Every property renders as a `.form-element` (see FormElement) carrying its own sh:name label,
// so a story's assertions can be scoped to "the field labelled X" rather than the whole canvas.
function fieldByLabel(canvasElement: HTMLElement, label: string): HTMLElement {
  const labelElement = within(canvasElement).getByText(label);
  const field = labelElement.closest(".form-element");
  if (!(field instanceof HTMLElement)) {
    throw new Error(`No .form-element found for label "${label}"`);
  }
  return field;
}

export const Edit: Story = {
  args: {
    shapesGraph: contactUrl,
    nodeShapes: [factory.namedNode(contactUrl.href)],
    dataGraph: new URL("john.ttl", import.meta.url),
    focusNode: factory.namedNode(johnUrl.href + "#john"),
  },
};

export const Create: Story = {
  args: {
    shapesGraph: contactUrl,
    nodeShapes: [factory.namedNode(contactUrl.href)],
  },
};

// sh:minCount/sh:maxCount drive whether Add/Remove show up at all (PropertyUIComponentAdd/Remove)
// - covers: below max with room to add, at max with no room, unbounded, and a field with more
// values than its minCount so removing is still allowed.
export const MinAndMaxCount: Story = {
  args: {
    shapesGraph: contactUrl,
    nodeShapes: [factory.namedNode(contactUrl.href)],
    dataGraph: new URL("john.ttl", import.meta.url),
    focusNode: factory.namedNode(johnUrl.href + "#john"),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(within(canvasElement).getByText("Given name")).toBeInTheDocument();
    });

    // minCount 1, maxCount 5, 2 existing values: room to add, and removing still leaves >= minCount.
    const givenName = fieldByLabel(canvasElement, "Given name");
    expect(within(givenName).getAllByRole("button", { name: "Remove value" })).toHaveLength(2);
    expect(within(givenName).getByRole("button", { name: "Add value" })).toBeInTheDocument();

    // minCount 1, maxCount 1, 1 existing value: at capacity and at the floor, so neither shows.
    const familyName = fieldByLabel(canvasElement, "Family name");
    expect(within(familyName).queryAllByRole("button", { name: "Remove value" })).toHaveLength(0);
    expect(within(familyName).queryByRole("button", { name: "Add value" })).not.toBeInTheDocument();

    // No minCount/maxCount declared at all: unbounded, so Add always shows and every value is removable.
    const children = fieldByLabel(canvasElement, "Children");
    expect(within(children).getAllByRole("button", { name: "Remove value" })).toHaveLength(3);
    expect(within(children).getByRole("button", { name: "Add value" })).toBeInTheDocument();

    // maxCount 1, no minCount, 1 existing value: at capacity but still above the (default 0) floor.
    const birthDate = fieldByLabel(canvasElement, "Date of birth");
    expect(within(birthDate).getAllByRole("button", { name: "Remove value" })).toHaveLength(1);
    expect(within(birthDate).queryByRole("button", { name: "Add value" })).not.toBeInTheDocument();
  },
};

// End-to-end write path: click Add, type into the fresh input, blur to commit, then Remove it -
// exercises PropertyUIElement.addObject/replaceObject/removeObject through the reactive data graph.
export const AddAndRemoveValues: Story = {
  args: {
    shapesGraph: contactUrl,
    nodeShapes: [factory.namedNode(contactUrl.href)],
    dataGraph: new URL("john.ttl", import.meta.url),
    focusNode: factory.namedNode(johnUrl.href + "#john"),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(within(canvasElement).getByText("Given name")).toBeInTheDocument();
    });
    const givenName = fieldByLabel(canvasElement, "Given name");
    expect(within(givenName).getAllByRole("textbox")).toHaveLength(2);

    await userEvent.click(within(givenName).getByRole("button", { name: "Add value" }));
    await waitFor(() => {
      expect(within(givenName).getAllByRole("textbox")).toHaveLength(3);
    });

    const newInput = within(givenName)
      .getAllByRole("textbox")
      .find((input) => (input as HTMLInputElement).value === "");
    expect(newInput).toBeDefined();
    await userEvent.type(newInput!, "Piet");
    await userEvent.tab();

    await waitFor(() => {
      expect(within(givenName).getByDisplayValue("Piet")).toBeInTheDocument();
    });
    expect(within(givenName).getAllByRole("button", { name: "Remove value" })).toHaveLength(3);

    const committedInput = within(givenName).getByDisplayValue("Piet");
    const removeButton = committedInput.nextElementSibling;
    expect(removeButton).not.toBeNull();
    await userEvent.click(removeButton as Element);

    await waitFor(() => {
      expect(within(givenName).queryByDisplayValue("Piet")).not.toBeInTheDocument();
    });
    expect(within(givenName).getAllByRole("textbox")).toHaveLength(2);
  },
};

// sh:severity (defaulting to sh:Violation when absent) only applies once sh:minCount is unmet -
// so this uses no data at all: every required field below is missing its value.
export const Severity: Story = {
  args: {
    shapesGraph: severityUrl,
    nodeShapes: [factory.namedNode(severityUrl.href)],
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(within(canvasElement).getByText("Given name")).toBeInTheDocument();
    });

    expect(fieldByLabel(canvasElement, "Given name")).toHaveAttribute("data-severity", "Violation");
    expect(fieldByLabel(canvasElement, "Family name")).toHaveAttribute("data-severity", "Warning");
    expect(fieldByLabel(canvasElement, "Nickname")).toHaveAttribute("data-severity", "Info");
    // Optional (no sh:minCount): nothing is missing, so no severity applies at all.
    expect(fieldByLabel(canvasElement, "Job title")).not.toHaveAttribute("data-severity");
  },
};

// The widget scoring system (score()/getWidgetComponent) picks a different editor per
// sh:datatype/sh:in without any value present yet - covers boolean, date, numeric and enum.
export const DatatypeWidgets: Story = {
  args: {
    shapesGraph: datatypeWidgetsUrl,
    nodeShapes: [factory.namedNode(datatypeWidgetsUrl.href)],
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(within(canvasElement).getByText("Is human")).toBeInTheDocument();
    });

    const isHuman = fieldByLabel(canvasElement, "Is human");
    expect(within(isHuman).getByRole("checkbox")).toBeInTheDocument();

    const birthDate = fieldByLabel(canvasElement, "Birth date");
    expect(birthDate.querySelector('input[type="date"]')).toBeInTheDocument();

    const householdMembers = fieldByLabel(canvasElement, "Household members");
    const numberInput = within(householdMembers).getByRole("spinbutton");
    expect(numberInput).toHaveAttribute("min", "0");
    expect(numberInput).toHaveAttribute("max", "20");
    expect(numberInput).toHaveAttribute("step", "1");

    const gender = fieldByLabel(canvasElement, "Gender");
    const options = within(gender).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Male", "Female", "Other"]);
  },
};

// interfaceLanguage drives the Fluent-localized UI strings (see l10n/ftl) independently of the
// shapes/data graphs - here the Add/Remove button labels should come back in Dutch.
export const InterfaceLanguage: Story = {
  args: {
    shapesGraph: contactUrl,
    nodeShapes: [factory.namedNode(contactUrl.href)],
    dataGraph: new URL("john.ttl", import.meta.url),
    focusNode: factory.namedNode(johnUrl.href + "#john"),
    interfaceLanguage: "nl-NL",
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(
        within(canvasElement).getAllByRole("button", { name: "Waarde toevoegen" }).length,
      ).toBeGreaterThan(0);
    });
    expect(
      within(canvasElement).getAllByRole("button", { name: "Waarde verwijderen" }).length,
    ).toBeGreaterThan(0);
  },
};
