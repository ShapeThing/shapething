import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, queryPrefixes, xsd } from "@/helpers/namespaces.ts";
import {
  aggregateFacetValues,
  countFacetInstancesInRange,
  countFacetInstancesMatchingPattern,
} from "@/structure/facetValues.ts";
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

test("countFacetInstancesInRange: counts instances whose numeric value falls within [min, max]", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:price .`,
    `ex:Widget ex:price 19.99 . ex:Gadget ex:price 42.50 . ex:Novel ex:price 12.00 .`,
  );
  const instances = [ex("Widget"), ex("Gadget"), ex("Novel")];

  expect(
    countFacetInstancesInRange(
      property,
      instances,
      factory.literal("15", xsd("decimal")),
      undefined,
    ),
  ).toBe(2); // Widget, Gadget
  expect(
    countFacetInstancesInRange(
      property,
      instances,
      factory.literal("15", xsd("decimal")),
      factory.literal("20", xsd("decimal")),
    ),
  ).toBe(1); // Widget only
});

test("countFacetInstancesInRange: compares xsd:date values chronologically, not lexically", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:releaseDate .`,
    `ex:Widget ex:releaseDate "2024-01-15"^^xsd:date .
     ex:Gadget ex:releaseDate "2025-06-01"^^xsd:date .
     ex:Novel ex:releaseDate "2023-09-10"^^xsd:date .`,
  );
  const instances = [ex("Widget"), ex("Gadget"), ex("Novel")];

  expect(
    countFacetInstancesInRange(
      property,
      instances,
      factory.literal("2024-01-01", xsd("date")),
      undefined,
    ),
  ).toBe(2); // Widget, Gadget
  expect(
    countFacetInstancesInRange(
      property,
      instances,
      factory.literal("2024-01-01", xsd("date")),
      factory.literal("2024-12-31", xsd("date")),
    ),
  ).toBe(1); // Widget only
});

test("countFacetInstancesInRange: returns 0 when neither bound is given - callers gate on this to distinguish 'nothing entered yet' from 'the range matches nothing'", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:price .`,
    `ex:Widget ex:price 19.99 .`,
  );

  expect(countFacetInstancesInRange(property, [ex("Widget")], undefined, undefined)).toBe(0);
});

test("countFacetInstancesMatchingPattern: counts instances with at least one matching value, case-insensitively via flags", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:name .`,
    `ex:Widget ex:name "Widget" . ex:Gadget ex:name "Gadget" .`,
  );
  const instances = [ex("Widget"), ex("Gadget")];

  expect(countFacetInstancesMatchingPattern(property, instances, "widget", "i")).toBe(1);
  expect(countFacetInstancesMatchingPattern(property, instances, "widget", undefined)).toBe(0);
});

test("countFacetInstancesMatchingPattern: an instance matching via more than one path branch still counts once", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path [ sh:alternativePath ( ex:name ex:description ) ] .`,
    `ex:Gadget ex:name "Gadget" ; ex:description "Does gadget things" .`,
  );

  expect(countFacetInstancesMatchingPattern(property, [ex("Gadget")], "gadget", "i")).toBe(1);
});

test("countFacetInstancesMatchingPattern: returns 0 when no pattern is given yet", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:name .`,
    `ex:Widget ex:name "Widget" .`,
  );

  expect(countFacetInstancesMatchingPattern(property, [ex("Widget")], undefined, undefined)).toBe(
    0,
  );
});
