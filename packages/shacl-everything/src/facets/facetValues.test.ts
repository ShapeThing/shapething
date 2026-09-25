import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, geosparql, queryPrefixes, xsd } from "@/helpers/namespaces.ts";
import {
  aggregateFacetValues,
  countFacetInstancesInRange,
  countFacetInstancesMatchingPattern,
  countFacetInstancesWithinArea,
} from "@/facets/facetValues.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

async function propertyFor(pathTurtle: string, dataTurtle: string) {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${pathTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    widgetRegistry: defaultWidgets,
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
    countFacetInstancesInRange(property, instances, {
      minInclusive: factory.literal("15", xsd("decimal")),
    }),
  ).toBe(2); // Widget, Gadget
  expect(
    countFacetInstancesInRange(property, instances, {
      minInclusive: factory.literal("15", xsd("decimal")),
      maxInclusive: factory.literal("20", xsd("decimal")),
    }),
  ).toBe(1); // Widget only
});

test("countFacetInstancesInRange: sh:minExclusive/sh:maxExclusive exclude their own boundary value", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:price .`,
    `ex:Widget ex:price 15 . ex:Gadget ex:price 20 . ex:Novel ex:price 25 .`,
  );
  const instances = [ex("Widget"), ex("Gadget"), ex("Novel")];

  // minInclusive 15 includes the Widget at exactly 15; minExclusive 15 excludes it.
  expect(
    countFacetInstancesInRange(property, instances, {
      minInclusive: factory.literal("15", xsd("decimal")),
    }),
  ).toBe(3);
  expect(
    countFacetInstancesInRange(property, instances, {
      minExclusive: factory.literal("15", xsd("decimal")),
    }),
  ).toBe(2); // Gadget, Novel

  // maxInclusive 20 includes the Gadget at exactly 20; maxExclusive 20 excludes it.
  expect(
    countFacetInstancesInRange(property, instances, {
      minExclusive: factory.literal("15", xsd("decimal")),
      maxInclusive: factory.literal("20", xsd("decimal")),
    }),
  ).toBe(1); // Gadget only
  expect(
    countFacetInstancesInRange(property, instances, {
      minExclusive: factory.literal("15", xsd("decimal")),
      maxExclusive: factory.literal("20", xsd("decimal")),
    }),
  ).toBe(0);
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
    countFacetInstancesInRange(property, instances, {
      minInclusive: factory.literal("2024-01-01", xsd("date")),
    }),
  ).toBe(2); // Widget, Gadget
  expect(
    countFacetInstancesInRange(property, instances, {
      minInclusive: factory.literal("2024-01-01", xsd("date")),
      maxInclusive: factory.literal("2024-12-31", xsd("date")),
    }),
  ).toBe(1); // Widget only
});

test("countFacetInstancesInRange: returns 0 when no bound is given - callers gate on this to distinguish 'nothing entered yet' from 'the range matches nothing'", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:price .`,
    `ex:Widget ex:price 19.99 .`,
  );

  expect(countFacetInstancesInRange(property, [ex("Widget")], {})).toBe(0);
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

test("countFacetInstancesWithinArea: counts instances with at least one location inside the drawn area", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:location .`,
    `ex:paris ex:location "POINT (2.35 48.85)"^^geosparql:wktLiteral .
     ex:tokyo ex:location "POINT (139.69 35.68)"^^geosparql:wktLiteral .`,
  );
  const instances = [ex("paris"), ex("tokyo")];
  const area = factory.literal(
    "POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))",
    geosparql("wktLiteral"),
  );

  expect(countFacetInstancesWithinArea(property, instances, area)).toBe(1); // Paris only
});

test("countFacetInstancesWithinArea: returns 0 when no area has been drawn yet", async () => {
  const property = await propertyFor(
    `ex:property1 sh:path ex:location .`,
    `ex:paris ex:location "POINT (2.35 48.85)"^^geosparql:wktLiteral .`,
  );

  expect(countFacetInstancesWithinArea(property, [ex("paris")], undefined)).toBe(0);
});
