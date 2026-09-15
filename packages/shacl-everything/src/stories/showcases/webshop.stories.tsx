import { useEffect, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { rdfParser } from "rdf-parse";
import stringToStream from "string-to-stream";
import ShaclRenderer from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { testingEnvironment, type SubmitResult } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, schema, sh } from "@/helpers/namespaces.ts";
import { instancesMatchingOtherConstraints, type FilterShape } from "@/structure/filterShape.ts";
import "./webshop.css";

const WEBSHOP_URL = new URL("webshop.ttl", import.meta.url);
const facetArgs = argsByTestFile("webshop.ttl", import.meta.url);
// <#viewShape> mirrors <#shape>'s fields but with a plain Name/Description pair instead of the
// facet-only "Search" sh:alternativePath property - a cleaner per-item view for the result cards
// below than reusing the facet shape would give.
const viewShapeNode = factory.namedNode(new URL("webshop.ttl#viewShape", import.meta.url).href);

// helpers/rdf.ts's own parseRdf has no baseIRI parameter (every existing caller is a unit test
// using only absolute IRIs), so it can't be reused here: <#shape>/<#viewShape>/<#data>/... are
// relative IRIs, and without an explicit baseIRI they'd resolve against rdf-parse's own default
// base instead of this fixture's real URL - silently mismatching viewShapeNode above (built
// straight off that real URL) and leaving every result card's shapesGraph lookup empty. This
// mirrors preprocess/resolveRdfSources.ts's own dereferenceUrl, which sets baseIRI: url.href for
// exactly this reason.
async function fetchTurtleStore(url: URL): Promise<RdfStore> {
  const text = await fetch(url).then((response) => response.text());
  const store = RdfStore.createDefault();
  const quadStream = rdfParser.parse(stringToStream(text), {
    contentType: "text/turtle",
    baseIRI: url.href,
  });
  return new Promise((resolve, reject) => {
    store
      .import(quadStream)
      .on("end", () => resolve(store))
      .on("error", reject);
  });
}

/**
 * Facet mode's own generated filter shape (structure/filterShape.ts's FilterShape) is a plain,
 * standard SHACL NodeShape - "which products match it" is answered here via
 * instancesMatchingOtherConstraints, the same matcher FacetPropertyComponent already uses for live
 * per-facet option counts, rather than a generic SHACL validator. st:ColorFacet's own st:colorBucket
 * constraint (see its own widget.tsx) is one of the predicates that matcher recognizes directly -
 * it also keeps a sibling sh:sparql SPARQLConstraint in sync (structure/filterShape.ts's
 * syncColorBucketSparqlConstraint) for a real SHACL-SPARQL-conformant engine, which this showcase
 * doesn't need since it already trusts this codebase's own matcher for every facet kind it uses
 * (sh:in for Category, sh:pattern for Search, plain decimal range for Price, st:colorBucket for
 * Color).
 */
function findMatchingProducts(
  productsStore: RdfStore,
  filterShapeStore: RdfStore | undefined,
): NamedNode[] {
  const productNodes = productsStore
    .getQuads(null, rdf("type"), schema("Product"))
    .map((quad) => quad.subject as NamedNode);

  const rootNode = filterShapeStore?.getQuads(null, rdf("type"), sh("NodeShape"))[0]
    ?.subject as Quad_Subject | undefined;
  if (!filterShapeStore || !rootNode) return productNodes;

  const filterShape: FilterShape = { store: filterShapeStore, rootNode: rootNode as NamedNode };
  return instancesMatchingOtherConstraints(
    filterShape,
    productsStore,
    productsStore,
    productNodes,
    undefined,
  ) as NamedNode[];
}

function WebshopShowcase() {
  const [productsStore, setProductsStore] = useState<RdfStore>();
  const [filterShapeStore, setFilterShapeStore] = useState<RdfStore>();
  const [matchingProducts, setMatchingProducts] = useState<NamedNode[]>();

  useEffect(() => {
    let cancelled = false;
    fetchTurtleStore(WEBSHOP_URL).then((store) => {
      if (!cancelled) setProductsStore(store);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!productsStore) return;
    setMatchingProducts(findMatchingProducts(productsStore, filterShapeStore));
  }, [productsStore, filterShapeStore]);

  return (
    <div className="webshop-showcase">
      <div className="webshop-showcase__facets">
        <ShaclRenderer
          {...testingEnvironment}
          {...facetArgs}
          mode="facet"
          interfaceLanguage="en-GB"
          interfaceLocales={{ "nl-NL": null }}
          onSubmit={(result: SubmitResult) => setFilterShapeStore(result.dataGraph)}
        />
      </div>
      <div className="webshop-showcase__results">
        <h2 className="webshop-showcase__results-heading">
          Results{matchingProducts ? ` (${matchingProducts.length})` : ""}
        </h2>
        <div className="webshop-showcase__grid">
          {productsStore &&
            matchingProducts?.map((focusNode) => (
              <div className="webshop-showcase__card" key={focusNode.value}>
                <ShaclRenderer
                  {...testingEnvironment}
                  shapesGraph={productsStore}
                  dataGraph={productsStore}
                  nodeShapes={[viewShapeNode]}
                  focusNode={focusNode}
                  mode="view"
                  viewModeLabelLayout="inline"
                  interfaceLanguage="en-GB"
                  interfaceLocales={{ "nl-NL": null }}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

type Story = StoryObj<typeof WebshopShowcase>;

export default {
  title: "Showcases/Webshop",
  component: WebshopShowcase,
};

// A clothing webshop's product catalog, end to end: facet mode on the left (text search, Category
// via st:CategoryFacet, Color via st:ColorFacet bucketing each product's own schema:color HSL
// value (st:hue/st:saturation/st:lightness - see helpers/colorBuckets.ts) into named hue buckets,
// and a Price range), and the actual matching products on the right, each rendered with
// ShaclRenderer itself (mode: "view") - schema:color there is the same HSL blank node, rendered
// via the opt-in st:ColorViewer (see <#viewShape> in webshop.ttl) - rather than a hand-rolled
// list. See findMatchingProducts above for how "matching" is decided.
export const webshop: Story = {
  name: "Facets + Results",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => expect(canvas.getByText("Results (29)")).toBeInTheDocument(), {
      timeout: 10000,
    });
    // Each result card mounts its own ShaclRenderer (view mode), which suspends through its own
    // preprocessing pass before it has anything to show - so the card's own text takes a moment
    // longer to appear than the (already-computed) heading count above.
    await waitFor(() => expect(canvas.getByText("Denim Jacket")).toBeInTheDocument(), {
      timeout: 15000,
    });

    // Color: ColorFacet buckets each product's own schema:color HSL value (st:hue/st:saturation/
    // st:lightness, helpers/colorBuckets.ts) by hue and writes a single st:colorBucket value (e.g.
    // "red") - not a range, not an exact-match list of hex values.
    const redSwatch = await canvas.findByRole("radio", { name: /Red/ });
    await userEvent.click(redSwatch);
    await waitFor(() => expect(canvas.getByText("Results (4)")).toBeInTheDocument(), {
      timeout: 10000,
    });
    await waitFor(() => expect(canvas.getByText("Canvas Sneakers")).toBeInTheDocument(), {
      timeout: 15000,
    });
    expect(canvas.queryByText("Denim Jacket")).not.toBeInTheDocument();

    // Clicking the already-selected bucket clears it again (ColorFacet/widget.tsx's own toggle-off).
    await userEvent.click(redSwatch);
    await waitFor(() => expect(canvas.getByText("Results (29)")).toBeInTheDocument(), {
      timeout: 10000,
    });

    // Category: selecting "Jeans" writes a plain sh:in constraint - the result grid narrowing from
    // 29 to the 5 actual Jeans products confirms the same matcher handles CategoryFacet's exact-
    // match constraint correctly too.
    const jeansCheckbox = await canvas.findByRole("checkbox", { name: /Jeans/ });
    await userEvent.click(jeansCheckbox);

    await waitFor(() => expect(canvas.getByText("Results (5)")).toBeInTheDocument(), {
      timeout: 10000,
    });
    await waitFor(() => expect(canvas.getByText("Slim Fit Jeans - Blue")).toBeInTheDocument(), {
      timeout: 15000,
    });
    expect(canvas.queryByText("Denim Jacket")).not.toBeInTheDocument();
  },
};
