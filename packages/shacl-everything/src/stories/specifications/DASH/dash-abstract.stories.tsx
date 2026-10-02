import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { rdf } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// dash:abstract true marks a class that can't have direct instances - only instances of its
// non-abstract subclasses (see helpers/isAbstract.ts). It never hides existing data; it only
// changes what can be *created*: "Create new…" offers the concrete subclasses instead, and
// shui:SubClassEditor won't pick an abstract class as a resource's own rdf:type.
export default {
  title: "Specifications/DASH/dash:abstract",
  component: ShaclRenderer,
};

const prefixes = `
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix ex: <http://example.org/> .
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix dash: <http://datashapes.org/dash#> .
`;

const animals = `
  ex:Animal a rdfs:Class, sh:NodeShape ;
    rdfs:label "Animal"@en ;
    dash:abstract true ;
    sh:property [
      sh:name "Name"@en ;
      sh:path rdfs:label ;
      sh:datatype xsd:string ;
      sh:maxCount 1 ;
      shui:propertyRole shui:LabelRole ;
    ] .
  ex:Dog a rdfs:Class, sh:NodeShape ;
    rdfs:label "Dog"@en ;
    rdfs:subClassOf ex:Animal ;
    sh:property [ sh:name "Breed"@en ; sh:path ex:breed ; sh:datatype xsd:string ; sh:maxCount 1 ] .
  ex:Cat a rdfs:Class, sh:NodeShape ;
    rdfs:label "Cat"@en ;
    rdfs:subClassOf ex:Animal .
`;

let submitted: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitted = result;
};

export const createInPlaceOffersConcreteSubclasses: Story = {
  name: '"Create new…" for an abstract sh:class offers one row per concrete subclass',
  args: {
    shapesGraph: `${prefixes}
      ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property [
          sh:name "Pet"@en ;
          sh:path ex:pet ;
          sh:class ex:Animal ;
          sh:nodeKind sh:IRI ;
          sh:maxCount 1 ;
          shui:editor shui:AutoCompleteEditor ;
        ] .
      ${animals}
    `,
    dataGraph: `${prefixes} ex:alice a ex:Person .`,
    nodeShapes: [factory.namedNode("http://example.org/PersonShape")],
    focusNode: factory.namedNode("http://example.org/alice"),
    enableCreateInPlace: true,
    onSubmit,
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    submitted = undefined;
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("- Select an option -", {}, { timeout: 5000 }));

    const listbox = await canvas.findByRole("listbox");
    const createRows = () =>
      within(listbox)
        .getAllByRole("option")
        .filter((option) => option.classList.contains("st-autocomplete__result--create"))
        .map((option) => option.textContent?.replace(/[⁨⁩]/g, "").trim());
    // ex:Animal itself is never offered - only its concrete subclasses, each by its own label.
    await waitFor(() => expect(createRows()).toEqual(["Create new Dog…", "Create new Cat…"]));

    await userEvent.click(within(listbox).getByText(/Dog/));
    const dialog = await canvas.findByRole("dialog");
    // The new Dog's form has its own field plus the one inherited from the abstract ex:Animal.
    await expect(within(dialog).findByText("Breed")).resolves.toBeVisible();
    expect(within(dialog).getByText("Name")).toBeVisible();
    await userEvent.type(within(dialog).getAllByRole("textbox")[0], "Rex");
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    await userEvent.click(await canvas.findByRole("button", { name: "Update" }));
    const result = await waitFor(() => {
      if (!submitted) throw new Error("onSubmit has not fired yet");
      return submitted;
    });
    const types = result.additions
      .filter((quad) => quad.predicate.equals(rdf("type")))
      .map((quad) => quad.object.value);
    expect(types).toEqual(["http://example.org/Dog"]);
  },
};

export const subClassEditorDisablesAbstractTypes: Story = {
  name: "shui:SubClassEditor on rdf:type can't pick an abstract class",
  args: {
    shapesGraph: `${prefixes}
      ex:ThingShape a sh:NodeShape ;
        sh:targetNode ex:rex ;
        sh:property [
          sh:name "Kind"@en ;
          sh:path rdf:type ;
          sh:rootClass ex:Animal ;
          sh:maxCount 1 ;
          shui:editor shui:SubClassEditor ;
        ] .
      ${animals}
    `,
    dataGraph: `${prefixes} ex:rex rdfs:label "Rex" .`,
    nodeShapes: [factory.namedNode("http://example.org/ThingShape")],
    focusNode: factory.namedNode("http://example.org/rex"),
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // An empty SubClassEditor opens its tree straight away (see its own mount-time focus).
    const animalRow = await canvas.findByText("Animal", {}, { timeout: 5000 });
    const animalInput = animalRow.closest("label")!.querySelector("input")!;
    const dogInput = canvas.getByText("Dog").closest("label")!.querySelector("input")!;
    expect(animalInput).toBeDisabled();
    expect(dogInput).toBeEnabled();

    await userEvent.click(canvas.getByText("Dog"));
    await waitFor(() => expect(canvasElement.querySelector(".st-value-chip")?.textContent).toContain("Dog"));
  },
};
