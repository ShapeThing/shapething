import { expect, test } from "vite-plus/test";
import { Engine as ShaclEngine } from "shacl-engine";
import { factory } from "@/helpers/factory.ts";
import { ex, schema } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { snapshotStore } from "@/helpers/snapshotStore.ts";
import { dirtyConstraints, isDirtyComparedTo } from "@/validation/dirtyConstraint.ts";

const shapes = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix st: <http://shapething.com/> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .

  ex:MustChange a sh:NodeShape ; st:dirty true .
  ex:MustNotChange a sh:NodeShape ; st:dirty false .
  ex:NamePropertyMustChange a sh:NodeShape ;
    sh:property [ sh:path schema:name ; st:dirty true ; sh:message "Change something first" ] .
`;

async function setup() {
  const shapesGraph = await parseRdf(shapes, "text/turtle");
  const dataGraph = await parseRdf(
    `<http://example.org/a> <http://schema.org/name> "A" .`,
    "text/turtle",
  );
  const isDirty = isDirtyComparedTo(snapshotStore(dataGraph));
  const engine = new ShaclEngine(shapesGraph.asDataset(), {
    factory,
    constraints: dirtyConstraints(isDirty),
  });
  const conforms = async (shape: string) => {
    const report = await engine.validate({ dataset: dataGraph.asDataset(), terms: [ex("a")] }, [
      { terms: [ex(shape)] },
    ]);
    return report;
  };
  return { dataGraph, conforms };
}

test("st:dirty true fails on unchanged data and passes once the data changes", async () => {
  const { dataGraph, conforms } = await setup();
  expect((await conforms("MustChange")).conforms).toBe(false);
  expect((await conforms("MustNotChange")).conforms).toBe(true);

  dataGraph.addQuad(factory.quad(ex("a"), schema("name"), factory.literal("B")));
  expect((await conforms("MustChange")).conforms).toBe(true);
  expect((await conforms("MustNotChange")).conforms).toBe(false);
});

test("st:dirty counts deletions, and reverting a change makes the data clean again", async () => {
  const { dataGraph, conforms } = await setup();
  const [original] = dataGraph.getQuads();
  dataGraph.removeQuad(original);
  expect((await conforms("MustChange")).conforms).toBe(true);

  dataGraph.addQuad(original);
  expect((await conforms("MustChange")).conforms).toBe(false);
});

test("st:dirty on a property shape reports against that property shape, with its sh:message", async () => {
  const { conforms } = await setup();
  const report = await conforms("NamePropertyMustChange");
  expect(report.conforms).toBe(false);
  expect(report.results).toHaveLength(1);
  expect(report.results[0].message.map((message) => message.value)).toEqual([
    "Change something first",
  ]);
});
