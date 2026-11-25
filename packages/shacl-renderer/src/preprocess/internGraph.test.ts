import { expect, test } from "vite-plus/test";
import { defaultEnvironment } from "@/environment.ts";
import { ex } from "@/helpers/namespaces.ts";
import { runPreprocessors } from "@/preprocess/index.ts";

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix ex: <http://example.org/> .
  ex:ThingShape a sh:NodeShape ; sh:targetClass ex:Thing ;
    sh:property [ sh:path ex:name ; sh:datatype <http://www.w3.org/2001/XMLSchema#string> ] .
`;
const data = (name: string) => `
  @prefix ex: <http://example.org/> .
  ex:${name} a ex:Thing ; ex:name "${name}" .
`;

test("rendering the same shapes for another resource reuses the same shapes store", async () => {
  const first = await runPreprocessors({
    ...defaultEnvironment,
    shapesGraph,
    dataGraph: data("a"),
    focusNode: ex("a"),
  });
  const second = await runPreprocessors({
    ...defaultEnvironment,
    shapesGraph,
    dataGraph: data("b"),
    focusNode: ex("b"),
  });
  expect(second.shapesGraph).toBe(first.shapesGraph);
  expect(second.dataGraph).not.toBe(first.dataGraph);
  expect(second.nodeShapes.map((shape) => shape.value)).toEqual([ex("ThingShape").value]);
});

test("different shapes get their own store", async () => {
  const first = await runPreprocessors({
    ...defaultEnvironment,
    shapesGraph,
    dataGraph: data("a"),
  });
  const other = await runPreprocessors({
    ...defaultEnvironment,
    shapesGraph: `${shapesGraph}\n<http://example.org/Other> a <http://www.w3.org/ns/shacl#NodeShape> .`,
    dataGraph: data("a"),
  });
  expect(other.shapesGraph).not.toBe(first.shapesGraph);
});
