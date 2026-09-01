import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { rdf, sh } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Facets/Type union",
  component: ShaclRenderer,
};

const shapesAndData = `
@prefix ex: <http://example.org/>.
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix schema: <http://schema.org/>.
@prefix sh: <http://www.w3.org/ns/shacl#>.

ex:productShape
    a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property [
        sh:name "Search"@en ;
        sh:path [ sh:alternativePath ( schema:name schema:description ) ] ;
        sh:order 0 ;
    ] ;
    sh:property [
        sh:name "Category"@en ;
        sh:path schema:category ;
        sh:class ex:Category ;
        sh:order 1 ;
    ] ;
    .

ex:personShape
    a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:name "Given name"@en ;
        sh:path schema:givenName ;
        sh:datatype xsd:string ;
    ] ;
    .

ex:Electronics a ex:Category ; rdfs:label "Electronics"@en .
ex:Books a ex:Category ; rdfs:label "Books"@en .

ex:data
    a schema:Product ;
    schema:name "Widget" ;
    schema:description "A useful little widget" ;
    schema:category ex:Electronics .

ex:alice a schema:Person ; schema:givenName "Alice" .
`;

let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

// Environment.enableFacetTypeUnion: instead of an explicit TypeSelector restricting the sidebar to
// one type at a time, every discovered root shape's properties render together - Product's own
// Search/Category facets alongside Person's only facet, Given name - and there is no synthetic
// rdf:type facet anywhere. Each ordinary facet is its own implicit type selector: setting a
// Product-only constraint and a Person-only constraint at the same time is exactly the "select
// across multiple rdf:types, narrowed to their intersection" the flag is for.
export const unionModeShowsEveryTypesFacetsAtOnce: Story = {
  name: "Every discovered type's facets render together, with no type picker",
  args: {
    shapesGraph: shapesAndData,
    dataGraph: shapesAndData,
    mode: "facet",
    enableFacetTypeUnion: true,
    onSubmit,
  },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    // No type picker at all - and both types' facets are already on screen without picking anything.
    const search = (await canvas.findByLabelText("Search")) as HTMLInputElement;
    const givenName = (await canvas.findByLabelText("Given name")) as HTMLInputElement;
    const electronics = (await canvas.findByLabelText("Electronics")) as HTMLInputElement;
    expect(canvas.queryAllByRole("radio")).toEqual([]);

    // A Product-only constraint (Category) and a Person-only constraint (Given name), set at the
    // same time - two facets belonging to different types, coexisting on the one generated shape.
    await userEvent.type(search, "widget");
    await userEvent.click(electronics);
    await userEvent.type(givenName, "Alice");

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      // Three independent sh:property entries - Search, Category, Given name - with no rdf:type
      // constraint anywhere among them.
      expect(submitResult.dataGraph.getQuads(null, sh("property")).length).toBe(3);
      expect(
        submitResult.dataGraph
          .getQuads(null, sh("pattern"))
          .map((quad) => quad.object.value)
          .sort(),
      ).toEqual(["Alice", "widget"]);
      expect(submitResult.dataGraph.getQuads(null, sh("in")).length).toBe(1);
      expect(submitResult.dataGraph.getQuads(null, sh("path"), rdf("type"))).toEqual([]);
    });
  },
};
