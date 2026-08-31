import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex, sh } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases",
  component: ShaclRenderer,
};

export const academic: Story = {
  name: "Academic (edit)",
  args: {
    ...argsByTestFile("academic.ttl", import.meta.url),
    nodeShapes: [ex("ResearcherShape"), ex("PersonShape")],
  },
};

export const academicView: Story = {
  name: "Academic (view)",
  args: {
    ...argsByTestFile("academic.ttl", import.meta.url),
    nodeShapes: [ex("ResearcherShape"), ex("PersonShape")],
    mode: "view",
    viewModeLabelLayout: "inline",
    interfaceLocales: {
      "nl-NL": null, // remove Dutch from the shipped set, so only en-GB is available
    },
    // academic.ttl's sh:name/sh:description carry @nl tags, which would otherwise resurrect
    // nl-NL in interfaceLanguages despite the interfaceLocales removal above (see
    // enableInterfaceLanguageWithShapesLabelsOnly's doc comment in environment.ts).
    enableInterfaceLanguageWithShapesLabelsOnly: false,
  },
};

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx) -
// every story already gets a turtle preview of it for free in Storybook's "Submit" panel (see
// .storybook/withSubmitPreview.tsx). "live" mode (the default) fires a fresh snapshot on every
// debounced change.
let productCatalogSubmitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  productCatalogSubmitResult = result;
};

// The one requirement the whole facets plan was built around: a shapes graph with no facet-
// specific annotations at all (no st:facet declarations anywhere in this fixture) still renders a
// full, working facet sidebar - text search (sh:alternativePath), category (sh:class, options
// derived from the data), number range, and date range - purely from ordinary SHACL constraints,
// plus a type selector since this shapes graph declares two target classes (schema:Product and
// schema:Person).
export const productCatalogFacets: Story = {
  name: "Product catalog (facets)",
  args: {
    ...argsByTestFile("product-catalog-facets.ttl", import.meta.url),
    // This fixture's shapes don't follow argsByTestFile's "#shape" naming convention (it declares
    // two root shapes, #productShape and #personShape) - an empty nodeShapes lets facet mode
    // auto-discover both rather than filtering everything out looking for a nonexistent "#shape".
    nodeShapes: [],
    mode: "facet",
    onSubmit,
  },
  play: async ({ canvasElement }) => {
    productCatalogSubmitResult = undefined;
    const canvas = within(canvasElement);

    // The type selector shows up because two root shapes were discovered; Product is picked first
    // (stable order), so its four facets render below.
    const productRadio = (await canvas.findByRole("radio", {
      name: "Product",
    })) as HTMLInputElement;
    await canvas.findByRole("radio", { name: "Person" });
    const search = await canvas.findByRole("searchbox");
    await canvas.findByLabelText("Electronics");
    const [minPrice] = await canvas.findAllByRole("spinbutton");

    await userEvent.type(search, "widget");
    await userEvent.type(minPrice, "15");

    await waitFor(() => {
      if (!productCatalogSubmitResult) throw new Error("onSubmit has not fired yet");
      expect(
        productCatalogSubmitResult.dataGraph
          .getQuads(null, sh("pattern"))
          .map((quad) => quad.object.value),
      ).toEqual(["widget"]);
      expect(
        productCatalogSubmitResult.dataGraph
          .getQuads(null, sh("minInclusive"))
          .map((quad) => quad.object.value),
      ).toEqual(["15"]);
    });

    // Switching the type selector to Person swaps the rendered facets entirely, and also
    // constrains the generated shape's own rdf:type facet accordingly. The radio's own DOM
    // `checked` state must flip too, not just the underlying generated shape (a controlled radio
    // not kept live off the externally-mutated filterShape store would otherwise look unclickable).
    const personRadio = canvas.getByRole("radio", { name: "Person" }) as HTMLInputElement;
    await userEvent.click(personRadio);
    await waitFor(() => expect(personRadio.checked).toBe(true));
    expect(productRadio.checked).toBe(false);
    await canvas.findByLabelText("Given name");

    await waitFor(() => {
      const listHead = productCatalogSubmitResult!.dataGraph.getQuads(null, sh("in"))[0]?.object;
      if (!listHead) throw new Error("the type selector's sh:in has not been written yet");
    });
  },
};
