import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { ResolvedTerm } from "@/outputs/render/hooks/query.ts";
import { filterConformingResults } from "./validateSearchResults.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

const createShape = async (shapesTurtle: string, dataTurtle: string) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("Subject"),
    propertyShapes: [ex("property1")],
  });
};

const asResults = (...terms: ReturnType<typeof ex>[]): ResolvedTerm[] =>
  terms.map((term) => ({ term }));

test("filterConformingResults() drops a candidate that fails a local sh:class constraint", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:path ex:bornIn ; sh:class ex:Country .`,
    `
      ex:Netherlands a ex:Country .
      ex:NotACountry a ex:SomethingElse .
    `,
  );

  const kept = await filterConformingResults(
    shape,
    asResults(ex("Netherlands"), ex("NotACountry")),
  );

  expect(kept.map((result) => result.term.value)).toEqual([ex("Netherlands").value]);
});

test("filterConformingResults() keeps every candidate when there's nothing to check", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:path ex:bornIn .`, ``);

  const kept = await filterConformingResults(shape, asResults(ex("Anything")));

  expect(kept.map((result) => result.term.value)).toEqual([ex("Anything").value]);
});

test("filterConformingResults() filters against a local (no SERVICE) sh:in [ sh:select ] baseline, skipping local sh:class entirely", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:path ex:bornIn ; sh:class ex:Country ;
        sh:in [
          sh:select """
            PREFIX ex: <http://example.org/>
            SELECT ?value WHERE { ?value a ex:AllowedCountry }
          """ ;
        ] .
    `,
    `
      ex:Netherlands a ex:Country, ex:AllowedCountry .
      ex:Atlantis a ex:Country .
    `,
  );

  // Atlantis passes the local sh:class check (it is an ex:Country) but isn't in sh:in's
  // sh:select baseline set - it must still be dropped, confirming Step 1 (local constraints) is
  // skipped entirely in favor of Step 2 (sh:in membership) once sh:in is the dynamic form.
  const kept = await filterConformingResults(shape, asResults(ex("Netherlands"), ex("Atlantis")));

  expect(kept.map((result) => result.term.value)).toEqual([ex("Netherlands").value]);
});

test("filterConformingResults() checks sh:class and sh:node together", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:path ex:employer ;
        sh:class ex:Organization ; sh:node ex:dutchShape .
      ex:dutchShape a sh:NodeShape ; sh:property [ sh:path ex:country ; sh:hasValue ex:NL ] .
    `,
    `
      ex:Acme a ex:Organization ; ex:country ex:NL .
      ex:Globex a ex:Organization ; ex:country ex:DE .
      ex:Dutchy ex:country ex:NL .
    `,
  );

  const kept = await filterConformingResults(
    shape,
    asResults(ex("Acme"), ex("Globex"), ex("Dutchy")),
  );

  expect(kept.map((result) => result.term.value)).toEqual([ex("Acme").value]);
});

test("filterConformingResults() sees dataGraph writes made after its checker was cached", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:path ex:employer ;
        sh:class ex:Organization ; sh:node ex:dutchShape .
      ex:dutchShape a sh:NodeShape ; sh:property [ sh:path ex:country ; sh:hasValue ex:NL ] .
    `,
    `ex:Globex a ex:Organization ; ex:country ex:DE .`,
  );

  expect(await filterConformingResults(shape, asResults(ex("Globex")))).toEqual([]);

  shape.dataGraph.addQuad(factory.quad(ex("Globex"), ex("country"), ex("NL")));

  const kept = await filterConformingResults(shape, asResults(ex("Globex")));
  expect(kept.map((result) => result.term.value)).toEqual([ex("Globex").value]);
  // Validation only reads the dataGraph - its synthetic focus-node triple is never written into it.
  expect(shape.dataGraph.getQuads(null, ex("employer"))).toEqual([]);
});
