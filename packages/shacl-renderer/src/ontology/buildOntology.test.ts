import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { rdf, rdfs, sh, shui, st } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { buildOntology } from "@/ontology/buildOntology.ts";

const ontology = await parseRdf(await buildOntology(), "text/turtle");
const has = (subject: string, predicate: ReturnType<typeof st>, object: ReturnType<typeof st>) =>
  ontology.getQuads(st(subject), predicate, object).length > 0;

test("buildOntology - includes the hand-written terms", () => {
  expect(has("color", rdf("type"), rdf("Property"))).toBe(true);
  expect(has("GeoRole", rdf("type"), shui("PropertyRole"))).toBe(true);
});

test("buildOntology - types every st widget by its folder's category", () => {
  expect(has("GeoEditor", rdf("type"), shui("Editor"))).toBe(true);
  expect(has("MapViewer", rdf("type"), shui("Viewer"))).toBe(true);
  expect(has("CountFacet", rdf("type"), st("Facet"))).toBe(true);
  expect(has("TabbedPropertyGroup", rdfs("subClassOf"), sh("PropertyGroup"))).toBe(true);
});

test("buildOntology - carries widget labels from score.ttl", () => {
  const labels = ontology.getQuads(st("GeoEditor"), rdfs("label")).map((quad) => quad.object);
  expect(labels).toContainEqual(factory.literal("Geometry editor", "en"));
});

test("buildOntology - leaves out widget scores and the shapes they test against", () => {
  expect(ontology.getQuads(st("geoEditorScore20")).length).toBe(0);
  expect(ontology.getQuads(st("isGeoEditorWktLiteral")).length).toBe(0);
  expect(ontology.getQuads(null, rdf("type"), shui("WidgetScore")).length).toBe(0);
});

test("buildOntology - defines every term by the ontology", () => {
  const subjects = new Set(ontology.getQuads().map((quad) => quad.subject.value));
  subjects.delete(st("").value);
  for (const subject of subjects) {
    expect(ontology.getQuads(factory.namedNode(subject), rdfs("isDefinedBy"), st("")).length).toBe(1);
  }
});
