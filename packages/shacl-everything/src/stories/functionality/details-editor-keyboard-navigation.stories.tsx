import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Functionality/DetailsEditor keyboard navigation",
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
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const label = await canvas.findByRole("button", { name: "Address" }, { timeout: 5000 });
    await userEvent.click(label);
    await expect(label).toHaveFocus();

    // Tab from the label must reach the sh:or branch switcher (DetailsEditor's own fly-out) -
    // regression: it used to be skipped entirely once the fly-out was removed from tab order to
    // stop the sub-form eating every Tab press meant for it.
    await userEvent.tab();
    const branchSwitcher = canvasElement.querySelector<HTMLSelectElement>(
      ".st-property-object__fly-out select",
    );
    expect(branchSwitcher).not.toBeNull();
    await expect(branchSwitcher).toHaveFocus();

    // Shift+Tab from the fly-out returns straight to the label - it's a direct DOM neighbour.
    await userEvent.tab({ shift: true });
    await expect(label).toHaveFocus();

    // Continuing forward from the fly-out must land inside the nested sub-form, not exit past it -
    // regression: the fly-out and the sub-form's first field can't both be "immediately next" after
    // the label, so whichever fix reached one broke reaching the other.
    await userEvent.tab();
    await userEvent.tab();
    const streetInput = findFieldInput(canvasElement, "Street");
    await expect(streetInput).toHaveFocus();

    // Shift+Tab from inside the sub-form goes straight back to the label rather than re-visiting
    // the fly-out: every property (even a plain scalar one) gets its own PropertyUIComponentObject
    // wrapper, so once focus is on "Street" that wrapper - not DetailsEditor's - is the nearest
    // match (see useFocusWithinNearest), and the outer fly-out has already unmounted.
    await userEvent.tab({ shift: true });
    await expect(label).toHaveFocus();

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
