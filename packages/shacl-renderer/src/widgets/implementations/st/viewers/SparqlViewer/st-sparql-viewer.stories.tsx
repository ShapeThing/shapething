import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:SparqlViewer is a ShapeThing-original viewer, not part of the SHACL 1.2 Core spec or the shui:
// extension proposal - it lives in its own stories folder rather than alongside the spec-
// conformance suite, colocated with its implementation (see widget.tsx). A literal holding a
// SPARQL query (here an sh:select), shown as a syntax-highlighted code block, with the PREFIX lines
// its sh:prefixes declares in front. Opt-in only, through shui:viewer.
export default {
  title: "Specifications/ShapeThing (living document)/Viewers/st:SparqlViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stSparqlViewer: Story = {
  name: "A SELECT query, with the prefixes sh:prefixes declares",
  args: { ...argsByTestFile("st-sparql-viewer.ttl", import.meta.url), mode: "view" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector(".st-sparql-viewer")).not.toBeNull(), {
      timeout: 5000,
    });
    const viewer = canvasElement.querySelector(".st-sparql-viewer")!;
    // Highlighted: SELECT is the query's first keyword token, ?value a variable token.
    expect(viewer.querySelector(".st-sparql-viewer__query .token.keyword")?.textContent).toBe(
      "SELECT",
    );
    expect(viewer.querySelector(".token.variable")).not.toBeNull();
    // sh:prefixes' declaration comes first, marked as not part of the query text; the query
    // itself follows, trimmed of the Turtle long string's surrounding whitespace.
    expect(viewer.querySelector(".st-sparql-viewer__declared")?.textContent).toBe(
      "PREFIX skos: <http://www.w3.org/2004/02/skos/core#>",
    );
    expect(
      viewer.querySelector(".st-sparql-viewer__query")?.textContent?.startsWith("# Every concept"),
    ).toBe(true);
    await waitFor(() =>
      expect(canvas.getByText("A concept must not be broader than itself.")).toBeInTheDocument(),
    );
  },
};
