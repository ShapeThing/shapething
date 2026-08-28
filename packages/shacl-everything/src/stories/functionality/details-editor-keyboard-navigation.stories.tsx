import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/DetailsEditor keyboard navigation",
  component: ShaclRenderer,
};

// An sh:or between a free-text string and a nested sh:node (rendered via shui:DetailsEditor) -
// this is what actually exercises DetailsEditor's own fly-out (the branch switcher), unlike a
// plain sh:node property, which has nothing to switch and so never renders one.
const shapesAndData = `
@prefix shui: <http://www.w3.org/ns/shacl-ui/>.
@prefix ex: <http://example.org/>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix schema: <http://schema.org/>.
@prefix sh: <http://www.w3.org/ns/shacl#>.

ex:shape
    a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:name "Address"@en ;
        sh:path schema:address ;
        sh:or (
            [
                sh:name "As free text"@en ;
                sh:datatype xsd:string ;
                sh:singleLine false ;
            ]
            [
                sh:name "As structured fields"@en ;
                shui:editor shui:DetailsEditor ;
                sh:nodeKind sh:BlankNodeOrIRI ;
                sh:node [
                    sh:property [
                        sh:name "Street"@en ;
                        sh:path schema:streetAddress ;
                        sh:datatype xsd:string ;
                        sh:minCount 1 ;
                        sh:maxCount 1 ;
                    ] ;
                    sh:property [
                        sh:name "Postal code"@en ;
                        sh:path schema:postalCode ;
                        sh:datatype xsd:string ;
                        sh:minCount 1 ;
                        sh:maxCount 1 ;
                    ] ;
                ] ;
            ]
        ) ;
    ] ;
    .

ex:data
    a schema:Person ;
    schema:givenName "Hendrik" ;
    schema:address [
        schema:streetAddress "Dam 1" ;
        schema:postalCode "1012 AB" ;
    ] ;
    .
`;

// Finds a property's <input> by its visible field label rather than by role/label association -
// FormElement's own <label> isn't wired up with htmlFor, so accessible-name queries can't see it.
function findFieldInput(canvasElement: HTMLElement, name: string): HTMLInputElement {
  const fieldLabel = Array.from(canvasElement.querySelectorAll(".st-form-element__label")).find(
    (element) => element.textContent?.trim() === name,
  );
  const input = fieldLabel?.closest(".st-form-element")?.querySelector("input");
  if (!input) throw new Error(`Could not find an input for the "${name}" field`);
  return input as HTMLInputElement;
}

export const keyboardNavigation: Story = {
  name: "Tab reaches the branch switcher and the nested fields, in either direction",
  args: {
    shapesGraph: shapesAndData,
    dataGraph: shapesAndData,
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/data"),
    enableLogicalBranchSwitching: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const label = await canvas.findByRole("button", { name: "Address" }, { timeout: 5000 });
    await userEvent.click(label);
    await expect(label).toHaveFocus();

    // Tab from the label goes straight into DetailsEditor's nested sub-form - its fly-out (the
    // branch/widget switcher) has no special placement of its own and simply trails after the
    // whole widget in the DOM, same as every other widget's fly-out.
    await userEvent.tab();
    const streetInput = findFieldInput(canvasElement, "Street");
    await expect(streetInput).toHaveFocus();

    // ...and Shift+Tab from there goes straight back to the label - it's the widget's only other
    // focusable ancestor, nothing else sits between them.
    await userEvent.tab({ shift: true });
    await expect(label).toHaveFocus();

    // The sh:or branch switcher (DetailsEditor's own fly-out) is still reachable by Tab, just
    // further along now, after the sub-form's own fields rather than immediately after the label.
    // It's a custom listbox rather than a native <select> (see LogicalConstraintSwitcher/
    // SelectListbox), showing the currently active branch's name as its own accessible name.
    function isBranchSwitcher(element: Element | null): boolean {
      return (
        element?.matches(".st-listbox__trigger") === true &&
        element.textContent?.trim() === "As structured fields"
      );
    }
    let reachedBranchSwitcher = false;
    for (let tabs = 0; tabs < 10 && !reachedBranchSwitcher; tabs++) {
      await userEvent.tab();
      reachedBranchSwitcher = isBranchSwitcher(document.activeElement);
    }
    expect(reachedBranchSwitcher).toBe(true);

    // Clicking straight into a nested field must keep focus there - regression: the sub-form used
    // to be marked inert the instant it gained focus, which immediately blurred whatever had just
    // been clicked inside it.
    const postalCodeInput = findFieldInput(canvasElement, "Postal code");
    await userEvent.click(postalCodeInput);
    await expect(postalCodeInput).toHaveFocus();
    await userEvent.type(postalCodeInput, "1");
    await expect(postalCodeInput).toHaveFocus();
    await expect(postalCodeInput).toHaveValue("1012 AB1");
  },
};
