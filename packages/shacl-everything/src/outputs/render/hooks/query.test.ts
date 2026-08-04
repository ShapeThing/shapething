import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { fetchOptions, searchInstances } from "./query.ts";

const createShape = async (shapesTurtle: string, dataTurtle: string) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Subject"),
    propertyShapes: [ex("property1")],
  });
};

test("searchInstances() ranks a label+IRI match above a label-only match above an IRI-only match", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Person ; sh:node ex:PersonShape .
      ex:PersonShape sh:property ex:nameProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
    `,
    `
      ex:p1 a ex:Person ; ex:name "Ali Ambulance" .
      ex:ali-street-42 a ex:Person ; ex:name "Bob" .
      ex:both-ali a ex:Person ; ex:name "Ali" .
      ex:unrelated a ex:Person ; ex:name "Carol" .
    `,
  );

  const results = await searchInstances(shape, "ali");

  expect(results.map((result) => result.iri.value)).toEqual([
    ex("both-ali").value,
    ex("p1").value,
    ex("ali-street-42").value,
  ]);
});

test("searchInstances() falls back to IRI-only matching when there is no LabelRole", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:class ex:Person .`,
    `
      ex:ali-street-42 a ex:Person .
      ex:unrelated a ex:Person .
    `,
  );

  const results = await searchInstances(shape, "ali");

  expect(results.map((result) => result.iri.value)).toEqual([ex("ali-street-42").value]);
});

test("fetchOptions() resolves every requested iri's label in a single batched query", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Person ; sh:node ex:PersonShape .
      ex:PersonShape sh:property ex:nameProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
    `,
    `
      ex:p1 a ex:Person ; ex:name "Ali" .
      ex:p2 a ex:Person ; ex:name "Bob" .
      ex:p3 a ex:Person ; ex:name "Carol" .
    `,
  );

  const results = await fetchOptions(shape, [ex("p1"), ex("p3")]);

  expect(new Set(results.map((result) => result.iri.value))).toEqual(
    new Set([ex("p1").value, ex("p3").value]),
  );
  expect(results.find((result) => result.iri.value === ex("p1").value)?.label).toBe("Ali");
  expect(results.find((result) => result.iri.value === ex("p3").value)?.label).toBe("Carol");
});

test("fetchOptions() returns nothing for an empty iri list", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:class ex:Person .`, ``);

  expect(await fetchOptions(shape, [])).toEqual([]);
});
