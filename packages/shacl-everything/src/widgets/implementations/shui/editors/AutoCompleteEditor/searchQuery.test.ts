import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { searchQueryFor } from "./searchQuery.ts";

const createShape = async (shapesTurtle: string) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  return new PropertyUIElement({
    shapesGraph,
    dataGraph: await parseRdf("", "text/turtle"),
    focusNode: ex("Subject"),
    propertyShapes: [ex("property1")],
  });
};

test("searchQueryFor() reads shui:searchQuery declared directly on the property shape", async () => {
  const shape = await createShape(`
    ex:property1 a sh:PropertyShape ; sh:path ex:name ;
      shui:searchQuery "SELECT ?value WHERE { ?value a ex:Person }" .
  `);

  expect(searchQueryFor(shape)).toBe("SELECT ?value WHERE { ?value a ex:Person }");
});

test("searchQueryFor() returns undefined when only sh:in's sh:select is present", async () => {
  const shape = await createShape(`
    ex:property1 a sh:PropertyShape ; sh:path ex:name ;
      sh:in [ sh:select "SELECT ?value WHERE { ?value a ex:Person }" ] .
  `);

  expect(searchQueryFor(shape)).toBeUndefined();
});

test("searchQueryFor() ignores an unrelated sh:in [ sh:select ] sibling entirely", async () => {
  const shape = await createShape(`
    ex:property1 a sh:PropertyShape ; sh:path ex:name ;
      shui:searchQuery "SELECT ?value WHERE { ?value a ex:Person }" ;
      sh:in [ sh:select "SELECT ?value WHERE { ?value a ex:OtherClass }" ] .
  `);

  expect(searchQueryFor(shape)).toBe("SELECT ?value WHERE { ?value a ex:Person }");
});

test("searchQueryFor() returns undefined when neither is declared", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:path ex:name .`);

  expect(searchQueryFor(shape)).toBeUndefined();
});
