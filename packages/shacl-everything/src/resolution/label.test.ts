import { expect, test } from "vite-plus/test";
import type { NamedNode } from "@rdfjs/types";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { propertyLabel, valueNodeLabel } from "@/resolution/label.ts";

const createShape = async ({
  shapes,
  data,
  scores,
  propertyShapes,
}: {
  shapes: string;
  data?: string;
  scores?: string;
  propertyShapes: NamedNode[];
}) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapes}`, "text/turtle");
  const dataGraph = await parseRdf(data ? `${queryPrefixes}\n\n${data}` : "", "text/turtle");
  const scoresGraph = scores
    ? await parseRdf(`${queryPrefixes}\n\n${scores}`, "text/turtle")
    : undefined;
  return new PropertyUIElement({
    shapesGraph,
    dataGraph,
    scoresGraph,
    focusNode: ex("Alice"),
    propertyShapes,
  });
};

test("propertyLabel step 1: the property shape's own sh:name, only when isPropertyPath is set", async () => {
  const shape = await createShape({
    shapes: `
      ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:name "Given name" .
      ex:givenName rdfs:label "Should not be used" .
    `,
    propertyShapes: [ex("property1")],
  });

  expect(propertyLabel({ term: ex("givenName"), propertyShape: shape, isPropertyPath: true })).toBe(
    "Given name",
  );
});

test("propertyLabel does not leak the property shape's own sh:name when isPropertyPath is not set (e.g. labeling an unrelated term)", async () => {
  const shape = await createShape({
    shapes: `
      ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:name "Given name" .
      ex:SomeWidget rdfs:label "Some Widget" .
    `,
    propertyShapes: [ex("property1")],
  });

  expect(propertyLabel({ term: ex("SomeWidget"), propertyShape: shape })).toBe("Some Widget");
});

test("propertyLabel step 2 (data graph) wins over step 3 (shapes graph) when both are present", async () => {
  const shape = await createShape({
    shapes: `
      ex:property1 a sh:PropertyShape ; sh:path ex:givenName .
      ex:givenName rdfs:label "From shapes graph" .
    `,
    data: `ex:givenName rdfs:label "From data graph" .`,
    propertyShapes: [ex("property1")],
  });

  expect(propertyLabel({ term: ex("givenName"), propertyShape: shape, isPropertyPath: true })).toBe(
    "From data graph",
  );
});

test("propertyLabel step 3 (shapes graph) is used when the data graph has no matching triple", async () => {
  const shape = await createShape({
    shapes: `
      ex:property1 a sh:PropertyShape ; sh:path ex:givenName .
      ex:givenName rdfs:label "From shapes graph" .
    `,
    propertyShapes: [ex("property1")],
  });

  expect(propertyLabel({ term: ex("givenName"), propertyShape: shape, isPropertyPath: true })).toBe(
    "From shapes graph",
  );
});

test("propertyLabel's scoresGraph extension is only reached after data and shapes graph both miss", async () => {
  const shape = await createShape({
    shapes: `ex:property1 a sh:PropertyShape ; sh:path ex:givenName .`,
    scores: `ex:givenName rdfs:label "From scores graph" .`,
    propertyShapes: [ex("property1")],
  });

  expect(propertyLabel({ term: ex("givenName"), propertyShape: shape, isPropertyPath: true })).toBe(
    "From scores graph",
  );
});

test("propertyLabel falls back to the local name when nothing matches at any step", async () => {
  const shape = await createShape({
    shapes: `ex:property1 a sh:PropertyShape ; sh:path ex:givenName .`,
    propertyShapes: [ex("property1")],
  });

  expect(propertyLabel({ term: ex("givenName"), propertyShape: shape, isPropertyPath: true })).toBe(
    "givenName",
  );
});

test("propertyLabel: a configured shui:labelPreference overrides step 1's sh:name check and steps 2-3's default rdfs:label, uniformly", async () => {
  const shape = await createShape({
    shapes: `
      ex:config a shui:Configuration ; shui:labelPreference ( skos:prefLabel ) .
      ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:name "Ignored - not configured" .
      ex:givenName skos:prefLabel "From configured predicate" ; rdfs:label "Ignored - not configured" .
    `,
    propertyShapes: [ex("property1")],
  });

  expect(propertyLabel({ term: ex("givenName"), propertyShape: shape, isPropertyPath: true })).toBe(
    "From configured predicate",
  );
});

test("propertyLabel: shui:languagePreference is honored when no explicit languages are passed", async () => {
  const shape = await createShape({
    shapes: `
      ex:config a shui:Configuration ; shui:languagePreference ( "nl" "en" ) .
      ex:property1 a sh:PropertyShape ; sh:path ex:givenName .
      ex:givenName rdfs:label "Given name"@en, "Voornaam"@nl .
    `,
    propertyShapes: [ex("property1")],
  });

  expect(propertyLabel({ term: ex("givenName"), propertyShape: shape, isPropertyPath: true })).toBe(
    "Voornaam",
  );
});

test("propertyLabel: sh:languageIn on the property shape does NOT override the caller's own language selection (chrome, not content)", async () => {
  const shape = await createShape({
    shapes: `
      ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:languageIn ( "en" "nl" ) .
      ex:givenName rdfs:label "Given name"@en, "Voornaam"@nl .
    `,
    propertyShapes: [ex("property1")],
  });

  expect(
    propertyLabel({
      term: ex("givenName"),
      propertyShape: shape,
      languages: ["nl"],
      isPropertyPath: true,
    }),
  ).toBe("Voornaam");
});

test("valueNodeLabel step 1: a literal's own lexical form", async () => {
  const shape = await createShape({
    shapes: `ex:property1 a sh:PropertyShape .`,
    propertyShapes: [ex("property1")],
  });
  const literal = factory.literal("Alice", "en");

  expect(valueNodeLabel({ term: literal, propertyShape: shape })).toBe(literal);
});

test("valueNodeLabel step 3 (data graph, configured predicate, default rdfs:label)", async () => {
  const shape = await createShape({
    shapes: `ex:property1 a sh:PropertyShape .`,
    data: `ex:alice rdfs:label "Alice" .`,
    propertyShapes: [ex("property1")],
  });

  expect(valueNodeLabel({ term: ex("alice"), propertyShape: shape }).value).toBe("Alice");
});

test("valueNodeLabel step 4 (shapes graph, configured predicate) - previously entirely missing", async () => {
  const shape = await createShape({
    shapes: `ex:property1 a sh:PropertyShape . ex:alice rdfs:label "Alice from shapes" .`,
    propertyShapes: [ex("property1")],
  });

  expect(valueNodeLabel({ term: ex("alice"), propertyShape: shape }).value).toBe(
    "Alice from shapes",
  );
});

test("valueNodeLabel falls back to the IRI's local name resolution when nothing else matches", async () => {
  const shape = await createShape({
    shapes: `ex:property1 a sh:PropertyShape .`,
    propertyShapes: [ex("property1")],
  });

  expect(valueNodeLabel({ term: ex("someUnlabeledResource"), propertyShape: shape }).value).toBe(
    "someUnlabeledResource",
  );
});

test("valueNodeLabel falls back to the blank node's own identifier when there is no label data", async () => {
  const shape = await createShape({
    shapes: `ex:property1 a sh:PropertyShape .`,
    propertyShapes: [ex("property1")],
  });
  const blankNode = factory.blankNode();

  expect(valueNodeLabel({ term: blankNode, propertyShape: shape }).value).toBe(blankNode.value);
});
