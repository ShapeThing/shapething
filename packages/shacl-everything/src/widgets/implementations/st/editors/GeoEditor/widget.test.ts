import type { FeatureCollection } from "geojson";
import { expect, test } from "vite-plus/test";
import { ex, geosparql, queryPrefixes } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { syncFromEditor } from "./widget.tsx";

const createShape = async (dataTurtle = "") => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\nex:property1 a sh:PropertyShape ; sh:path ex:location .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Subject"),
    propertyShapes: [ex("property1")],
  });
};

function stubEditor(collection: FeatureCollection) {
  return { getAllFeatureCollection: () => collection };
}

test("syncFromEditor() removes a value whose feature is no longer on the map - this is the fix for deleting a pre-loaded point via the trash tool and it staying in the submit diff", async () => {
  const shape = await createShape(
    `ex:Subject ex:location "POINT (4.9041 52.3676)"^^geosparql:wktLiteral .`,
  );
  expect(shape.getObjects()).toHaveLength(1);

  syncFromEditor(shape, stubEditor({ type: "FeatureCollection", features: [] }));

  expect(shape.getObjects()).toHaveLength(0);
});

test("syncFromEditor() leaves an untouched value alone rather than removing and re-adding its (differently-formatted) canonical WKT", async () => {
  // Deliberately has trailing zeros wkt's own stringify() never reproduces (see
  // geometry.test.ts's canonicalWktValue test) - if syncFromEditor compared raw text instead of
  // canonical text, this exact-same-position feature would look "changed" and get needlessly
  // replaced.
  const original = 'ex:Subject ex:location "POINT (4.9041 52.3600)"^^geosparql:wktLiteral .';
  const shape = await createShape(original);
  const [existingTerm] = shape.getObjects();

  syncFromEditor(
    shape,
    stubEditor({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [4.9041, 52.36] }, properties: {} },
      ],
    }),
  );

  expect(shape.getObjects()).toEqual([existingTerm]);
});

test("syncFromEditor() adds a newly-drawn feature that has no matching existing value", async () => {
  const shape = await createShape();
  expect(shape.getObjects()).toHaveLength(0);

  syncFromEditor(
    shape,
    stubEditor({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [5, 52] }, properties: {} },
      ],
    }),
  );

  const [added] = shape.getObjects();
  expect(added?.value).toBe("POINT (5 52)");
  expect((added as { datatype: { value: string } }).datatype.value).toBe(
    geosparql("wktLiteral").value,
  );
});

test("syncFromEditor() replaces an edited value: old canonical WKT gone, new one added", async () => {
  const shape = await createShape(
    `ex:Subject ex:location "POINT (4.9041 52.3676)"^^geosparql:wktLiteral .`,
  );

  syncFromEditor(
    shape,
    stubEditor({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [5, 52] }, properties: {} },
      ],
    }),
  );

  expect(shape.getObjects().map((term) => term.value)).toEqual(["POINT (5 52)"]);
});

test("syncFromEditor() never touches an existing value it doesn't recognize as geometry", async () => {
  const shape = await createShape(`ex:Subject ex:location "just some text" .`);

  syncFromEditor(shape, stubEditor({ type: "FeatureCollection", features: [] }));

  expect(shape.getObjects().map((term) => term.value)).toEqual(["just some text"]);
});
