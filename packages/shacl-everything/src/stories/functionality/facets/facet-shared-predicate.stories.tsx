import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { sh } from "@/helpers/namespaces.ts";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Facets/Shared predicate across types",
  component: ShaclRenderer,
};

// ex:bookShape (schema:Book) and ex:movieShape (schema:Movie) each declare their own sh:path
// schema:name property shape independently, with no knowledge of each other - and likewise for
// schema:genre (sh:class ex:Genre). "Dune" is deliberately both a book's and a movie's name, and
// both happen to be Science Fiction, so the shared facets have a genuine cross-type intersection
// to demonstrate, not just a coincidentally-identical path.
const { shapesGraph, dataGraph } = argsByTestFile("facet-shared-predicate.ttl", import.meta.url);

let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

// Environment.enableFacetTypeUnion's own doc comment claims properties are "deduplicated by
// canonical path the same way a single shape's own co-path property shapes already are" - this is
// the dedicated coverage for that specific mechanic: childrenForShape's own co-path grouping
// (structure/propertiesForShape.ts) merges Book's and Movie's independently-declared schema:name
// property shapes into exactly one "Name" facet once every root shape's properties render
// together, not two separate, redundantly-labelled ones. Filtering by it (through the one shared
// facet) matches instances of *both* types at once, and with enableFacetOptionCounts on, that
// cross-type match shows up as a single count on the one shared facet, not two per-type tallies.
// Genre is a second, independent intersection, letting its own counts aggregate instances from
// both Books and Movies too, and narrow correctly once the Name search above is active.
export const sharedPathMergesIntoOneFacetAcrossTypes: Story = {
  name: "Two types independently declaring the same path merge into one facet",
  args: {
    shapesGraph,
    dataGraph,
    mode: "facet",
    enableFacetTypeUnion: true,
    enableFacetOptionCounts: true,
    onSubmit,
  },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    // Exactly one "Name" facet renders - not one per type - even though neither shape declares
    // any awareness of the other.
    const nameInputs = await canvas.findAllByLabelText("Name");
    expect(nameInputs).toHaveLength(1);
    const name = nameInputs[0] as HTMLInputElement;
    const nameContainer = name.closest(".st-form-element") as HTMLElement;

    // Author (Book-only) and Director (Movie-only) still render as their own separate facets.
    await canvas.findByLabelText("Author");
    await canvas.findByLabelText("Director");

    // Genre's own counts, before any filter is active: 4 Science Fiction (2 books + 2 movies),
    // 2 Romance (1 book + 1 movie) - one shared category facet aggregating both types' instances.
    await canvas.findByLabelText("Science Fiction (4)");
    await canvas.findByLabelText("Romance (2)");

    await userEvent.type(name, "Dune");

    // The shared Name facet's own live match count: exactly one book (Dune) and one movie (Dune)
    // match, both counted through this single facet. Scoped to the Name facet's own container -
    // Genre's "Science Fiction" count also happens to read "(2)" once narrowed below.
    await within(nameContainer).findByText("(2)");

    // Narrowed by the active Name search, Genre's counts update too: both "Dune" instances are
    // Science Fiction, so that count drops from 4 to 2 and Romance drops to 0 - the same live,
    // cross-facet narrowing (see facet-option-counts.stories.tsx), now proven to also aggregate
    // correctly across two different rdf:types through a shared property.
    await canvas.findByLabelText("Science Fiction (2)");
    await canvas.findByLabelText("Romance (0)");

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      // One sh:property entry for the shared Name path, not two duplicate ones.
      expect(
        submitResult.dataGraph.getQuads(null, sh("pattern")).map((quad) => quad.object.value),
      ).toEqual(["Dune"]);
      expect(submitResult.dataGraph.getQuads(null, sh("property")).length).toBe(1);
    });
  },
};
