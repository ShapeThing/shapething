import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { aggregateFacetValues } from "@/structure/facetValues.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

async function propertyFor(pathTurtle: string, dataTurtle: string) {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${pathTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
}

test("aggregateFacetValues: collects a property's values across every instance, deduped", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:age .`,
    `ex:Alice ex:age 30 . ex:Bob ex:age 25 . ex:Carol ex:age 30 .`,
  );

  const values = aggregateFacetValues(property, [ex("Alice"), ex("Bob"), ex("Carol")]);
  expect(values.map((term) => term.value).sort()).toEqual(["25", "30"]);
});

test("aggregateFacetValues: an instance missing the property contributes nothing", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:age .`, `ex:Alice ex:age 30 .`);

  const values = aggregateFacetValues(property, [ex("Alice"), ex("Bob")]);
  expect(values.map((term) => term.value)).toEqual(["30"]);
});

test("aggregateFacetValues: an sh:alternativePath aggregates across every branch", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path [ sh:alternativePath ( ex:name ex:description ) ] .`,
    `ex:Alice ex:name "Alice" . ex:Bob ex:description "A robot" .`,
  );

  const values = aggregateFacetValues(property, [ex("Alice"), ex("Bob")]);
  expect(values.map((term) => term.value).sort()).toEqual(["A robot", "Alice"]);
});
