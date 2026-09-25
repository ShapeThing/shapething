import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";
import { getShaclEngine } from "@/validation/validate.ts";

// Regression for patches/shacl-engine@1.0.2.patch: unpatched, shacl-engine compiles sh:memberShape's
// value as a node expression, so any blank-node member shape threw "Unable to compile node
// expression" - failing the whole validation pass (see ValidationContextProvider) rather than just
// that one list property. Calls the engine directly, not validate(), which swallows the error.
test("shacl-engine - validates a blank-node sh:memberShape (with shui:editor/viewer) per list item", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:RecipeShape a sh:NodeShape ;
            sh:property [
                sh:path ex:ingredients ;
                sh:memberShape [
                    sh:node ex:IngredientShape ;
                    shui:editor shui:DetailsEditor ;
                    shui:viewer shui:DetailsViewer ;
                ] ;
            ] .

        ex:IngredientShape a sh:NodeShape ;
            sh:property [ sh:path ex:name ; sh:datatype xsd:string ; sh:minCount 1 ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .

        ex:recipe ex:ingredients ( ex:flour ex:nameless ) .
        ex:flour ex:name "Flour" .
    `,
    "text/turtle",
  );

  const report = await getShaclEngine(shapesGraph).validate(
    { dataset: dataGraph.asDataset(), terms: [ex("recipe")] },
    [{ terms: [ex("RecipeShape")] }],
  );

  expect(report.conforms).toBe(false);
  expect(report.results.map((result) => result.focusNode.term.value)).toEqual([
    ex("recipe").value,
  ]);
});
