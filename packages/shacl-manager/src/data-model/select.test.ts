import { describe, expect, it } from "vitest";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { select } from "./select.ts";
import type { TypedQuery } from "@shapething/typed-sparql";

describe("select", () => {
  it("returns blank nodes that match the store's own blank nodes", async () => {
    const store = RdfStore.createDefault();
    const shape = factory.namedNode("http://example.org/Shape");
    const propertyShape = factory.blankNode("inline");
    const predicate = factory.namedNode("http://www.w3.org/ns/shacl#property");
    store.addQuad(factory.quad(shape, predicate, propertyShape));

    const query =
      "SELECT ?ps WHERE { ?s <http://www.w3.org/ns/shacl#property> ?ps }" as TypedQuery<{
        ps: typeof propertyShape;
      }>;
    const [row] = await select(query, store);

    expect(row.ps.termType).toBe("BlankNode");
    expect(store.getQuads(null, null, row.ps)).toHaveLength(1);
  });
});
