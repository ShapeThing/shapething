import { useEffect, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
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
 * per-facet option counts. That matcher runs a real shacl-engine validation pass for sh:in
 * (Category), sh:pattern (Search) and the plain decimal range (Price), and st:ColorFacet's own
 * st:colorBucket constraint (see its own widget.tsx) via its synced sh:sparql SPARQLConstraint
 * (structure/filterShape.ts's syncColorBucketSparqlConstraint) - a real SHACL-SPARQL-conformant
 * engine, not a hand-rolled reimplementation of what those constraints already mean.
 */
async function findMatchingProducts(
  productsStore: RdfStore,
  filterShapeStore: RdfStore | undefined,
): Promise<NamedNode[]> {
  const productNodes = productsStore
    .getQuads(null, rdf("type"), schema("Product"))
    .map((quad) => quad.subject as NamedNode);

  const rootNode = filterShapeStore?.getQuads(null, rdf("type"), sh("NodeShape"))[0]?.subject as
    | Quad_Subject
    | undefined;
  if (!filterShapeStore || !rootNode) return productNodes;

  const filterShape: FilterShape = { store: filterShapeStore, rootNode: rootNode as NamedNode };
  return (await instancesMatchingOtherConstraints(
    filterShape,
    productsStore,
    productNodes,
    undefined,
  )) as NamedNode[];
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
    let cancelled = false;
    findMatchingProducts(productsStore, filterShapeStore).then((matching) => {
      if (!cancelled) setMatchingProducts(matching);
    });
    return () => {
      cancelled = true;
    };
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
};
