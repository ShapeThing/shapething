import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { selectQueryFor } from "@/structure/selectQuery.ts";

async function propertyFor(shapesTurtle: string) {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(queryPrefixes, "text/turtle");
  return new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("unused"),
    propertyShapes: [ex("property1")],
  });
}

test("selectQueryFor: returns the sh:select text off a sh:in blank node", async () => {
  const property = await propertyFor(`
    ex:property1 sh:path ex:category ; sh:in [ sh:select "SELECT ?value WHERE { ?value a ex:Category }" ] .
  `);

  expect(selectQueryFor(property)).toBe("SELECT ?value WHERE { ?value a ex:Category }");
});

test("selectQueryFor: undefined for a plain rdf:List sh:in", async () => {
  const property = await propertyFor(`
    ex:property1 sh:path ex:category ; sh:in ( ex:Electronics ex:Books ) .
  `);

  expect(selectQueryFor(property)).toBeUndefined();
});

test("selectQueryFor: undefined when sh:in is absent entirely", async () => {
  const property = await propertyFor(`ex:property1 sh:path ex:category .`);

  expect(selectQueryFor(property)).toBeUndefined();
});
