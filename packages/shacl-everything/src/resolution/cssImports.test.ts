import { expect, test } from "vite-plus/test";
import { cssImportsForShapes } from "@/resolution/cssImports.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

test("cssImportsForShapes returns a shape's own st:cssImport URL", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix st: <http://shapething.com/> .

        ex:Recipe a sh:NodeShape ;
            st:cssImport <http://example.org/recipe.css> .
    `,
    "text/turtle",
  );

  expect(cssImportsForShapes([ex("Recipe")], shapesGraph)).toEqual([
    "http://example.org/recipe.css",
  ]);
});

test("cssImportsForShapes collects and dedupes across several node shapes, in order", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix st: <http://shapething.com/> .

        ex:MeatRecipe a sh:NodeShape ;
            st:cssImport <http://example.org/shared.css>, <http://example.org/meat.css> .

        ex:VeganRecipe a sh:NodeShape ;
            st:cssImport <http://example.org/shared.css> .
    `,
    "text/turtle",
  );

  expect(cssImportsForShapes([ex("MeatRecipe"), ex("VeganRecipe")], shapesGraph)).toEqual([
    "http://example.org/shared.css",
    "http://example.org/meat.css",
  ]);
});

test("cssImportsForShapes returns an empty array when no shape declares st:cssImport", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape .
    `,
    "text/turtle",
  );

  expect(cssImportsForShapes([ex("Recipe")], shapesGraph)).toEqual([]);
});
