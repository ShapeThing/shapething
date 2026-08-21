import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { ex, rdf, sh, xsd } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import {
  detectActiveBranch,
  logicalBranches,
  withBranch,
} from "@/structure/logicalBranches.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

async function contactShapesGraph() {
  return parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

        ex:Person a sh:NodeShape ;
            sh:property ex:contactShape .

        ex:contactShape a sh:PropertyShape ;
            sh:name "Contact"@en ;
            sh:path ex:contact ;
            sh:or (
                [ sh:name "Contact as string"@en ; sh:datatype xsd:string ]
                [ sh:name "Contact as language string"@en ; sh:datatype rdf:langString ]
            ) .
    `,
    "text/turtle",
  );
}

test("logicalBranches extracts each sh:or branch from a property shape", async () => {
  const shapesGraph = await contactShapesGraph();
  const dataGraph = await parseRdf("", "text/turtle");

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Hendrik"),
    propertyShapes: [ex("contactShape")],
  });

  const branches = logicalBranches(element);
  expect(branches).toHaveLength(2);
  expect(branches[0].connective).toBe("or");
  expect(branches[1].connective).toBe("or");
});

test("withBranch merges a branch's own constraints (e.g. sh:datatype) into the property", async () => {
  const shapesGraph = await contactShapesGraph();
  const dataGraph = await parseRdf("", "text/turtle");

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Hendrik"),
    propertyShapes: [ex("contactShape")],
  });

  // The outer property shape alone has no sh:datatype - it only appears once a branch is merged in.
  expect(element.get(sh("datatype"))).toBeUndefined();

  const [stringBranch, langStringBranch] = logicalBranches(element);
  expect(withBranch(element, stringBranch.shape).get(sh("datatype"))?.value)
    .toBe(
      xsd("string").value,
    );
  expect(withBranch(element, langStringBranch.shape).get(sh("datatype"))?.value)
    .toBe(
      rdf("langString").value,
    );

  // The outer property's own sh:name should still win over a branch's - withBranch() shouldn't
  // change which label the property itself displays.
  expect(withBranch(element, stringBranch.shape).get(sh("name"))?.value).toBe(
    "Contact",
  );
});

test("detectActiveBranch picks the branch a literal's datatype already conforms to", async () => {
  const shapesGraph = await contactShapesGraph();
  const dataGraph = await parseRdf("", "text/turtle");

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Hendrik"),
    propertyShapes: [ex("contactShape")],
  });

  const branches = logicalBranches(element);
  const [stringBranch, langStringBranch] = branches;

  const plainString = factory.literal("hendrik@example.org", xsd("string"));
  const languageString = factory.literal("hendrik@example.org", "en");

  const detectedForString = await detectActiveBranch(
    element,
    plainString,
    branches,
  );
  expect(detectedForString?.shape.equals(stringBranch.shape)).toBe(true);

  const detectedForLangString = await detectActiveBranch(
    element,
    languageString,
    branches,
  );
  expect(detectedForLangString?.shape.equals(langStringBranch.shape)).toBe(
    true,
  );
});

test("detectActiveBranch returns undefined when no branch conforms", async () => {
  const shapesGraph = await contactShapesGraph();
  const dataGraph = await parseRdf("", "text/turtle");

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Hendrik"),
    propertyShapes: [ex("contactShape")],
  });

  const branches = logicalBranches(element);
  const nonConforming = factory.literal("42", xsd("integer"));

  expect(await detectActiveBranch(element, nonConforming, branches))
    .toBeUndefined();
});

test("logicalBranches returns an empty array for a property with no sh:or/sh:xone", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .

        ex:Recipe a sh:NodeShape ;
            sh:property ex:titleShape .

        ex:titleShape a sh:PropertyShape ;
            sh:path ex:title .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("ChickenSoup"),
    propertyShapes: [ex("titleShape")],
  });

  expect(logicalBranches(element)).toHaveLength(0);
});
