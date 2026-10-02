import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { iriTypesFor } from "./iriType.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

const createShape = async (shapesTurtle: string) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  return new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph: await parseRdf("", "text/turtle"),
    focusNode: ex("Subject"),
    propertyShapes: [ex("property1")],
  });
};

test("iriTypesFor() returns undefined (search both) when st:iriType isn't declared", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:path ex:name .`);

  expect(iriTypesFor(shape)).toBeUndefined();
});

test("iriTypesFor() maps rdfs:Class to \"class\"", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:path ex:name ; st:iriType rdfs:Class .`,
  );

  expect(iriTypesFor(shape)).toEqual(["class"]);
});

test("iriTypesFor() maps rdf:Property to \"property\"", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:path ex:name ; st:iriType rdf:Property .`,
  );

  expect(iriTypesFor(shape)).toEqual(["property"]);
});

test("iriTypesFor() collects both when both are declared", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:path ex:name ; st:iriType rdf:Property, rdfs:Class .`,
  );

  expect(iriTypesFor(shape)).toEqual(expect.arrayContaining(["property", "class"]));
  expect(iriTypesFor(shape)).toHaveLength(2);
});

test("iriTypesFor() ignores an unrecognized st:iriType value rather than throwing", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:path ex:name ; st:iriType ex:SomeOtherThing .`,
  );

  expect(iriTypesFor(shape)).toBeUndefined();
});
