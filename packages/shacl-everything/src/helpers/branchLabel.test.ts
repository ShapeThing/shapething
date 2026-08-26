import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { branchLabel } from "@/helpers/branchLabel.ts";

const graph = (turtle: string) => parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");

test("branchLabel uses the branch shape's own sh:name", async () => {
  const shapesGraph = await graph(`ex:branch1 sh:name "Given as a string" .`);
  expect(branchLabel(ex("branch1"), shapesGraph, [])).toBe("Given as a string");
});

test("branchLabel falls back through sh:datatype, sh:class, sh:node, then the branch's own value", async () => {
  const shapesGraph = await graph(`ex:branch1 sh:datatype xsd:string .`);
  expect(branchLabel(ex("branch1"), shapesGraph, [])).toBe("string");

  const classOnly = await graph(`ex:branch2 sh:class ex:Animal .`);
  expect(branchLabel(ex("branch2"), classOnly, [])).toBe("Animal");

  const nodeOnly = await graph(`ex:branch3 sh:node ex:AnimalShape .`);
  expect(branchLabel(ex("branch3"), nodeOnly, [])).toBe("AnimalShape");

  const nothing = await graph(`ex:branch4 a sh:PropertyShape .`);
  expect(branchLabel(ex("branch4"), nothing, [])).toBe(ex("branch4").value);
});

test("branchLabel: sh:languageIn on the branch shape does NOT override the caller's own language selection (chrome, not content - mirrors propertyLabel)", async () => {
  const shapesGraph = await graph(
    `ex:branch1 sh:languageIn ( "fr" "en" ) ; sh:name "Name"@en, "Nom"@fr .`,
  );
  expect(branchLabel(ex("branch1"), shapesGraph, ["en"])).toBe("Name");
});

test("branchLabel: shui:languagePreference is honored when no explicit languages are passed", async () => {
  const shapesGraph = await graph(`
    ex:config a shui:Configuration ; shui:languagePreference ( "fr" "en" ) .
    ex:branch1 sh:name "Name"@en, "Nom"@fr .
  `);
  expect(branchLabel(ex("branch1"), shapesGraph, [])).toBe("Nom");
});

test("branchLabel: a globally configured shui:labelPreference is applied to the branch's own step 1", async () => {
  const shapesGraph = await graph(`
    ex:config a shui:Configuration ; shui:labelPreference ( skos:prefLabel ) .
    ex:branch1 sh:name "Ignored - not configured" ; skos:prefLabel "From configured predicate" .
  `);
  expect(branchLabel(ex("branch1"), shapesGraph, [])).toBe("From configured predicate");
});
