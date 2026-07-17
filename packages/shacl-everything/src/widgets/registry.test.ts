import { expect, test } from "vite-plus/test";
import {
  getScoringGraph,
  getWidgetComponent,
  getWidgetMeta,
} from "@/widgets/registry.ts";
import { rdf, sh, shui } from "@/helpers/namespaces.ts";
import { score } from "@/scoring/score.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";

test("getScoringGraph combines the shared widget-scoring.ttl shapes with every editor score.ttl", async () => {
  const scoringGraph = await getScoringGraph("edit");

  // A shape from the shared widget-scoring.ttl.
  expect(scoringGraph.getQuads(shui("isBoolean"), rdf("type"), sh("NodeShape")))
    .toHaveLength(1);

  // A WidgetScore that only exists for the BooleanEditor.
  expect(
    scoringGraph.getQuads(null, shui("widget"), shui("BooleanEditor")).length,
  ).toBeGreaterThan(
    0,
  );

  // Viewer-only widgets should not be present in the editor graph.
  expect(scoringGraph.getQuads(null, shui("widget"), shui("LiteralViewer")))
    .toHaveLength(0);
});

test("getScoringGraph combines the shared widget-scoring.ttl shapes with every viewer score.ttl", async () => {
  const scoringGraph = await getScoringGraph("view");

  expect(
    scoringGraph.getQuads(null, shui("widget"), shui("LiteralViewer")).length,
  ).toBeGreaterThan(
    0,
  );

  // Editor-only widgets should not be present in the viewer graph.
  expect(scoringGraph.getQuads(null, shui("widget"), shui("BooleanEditor")))
    .toHaveLength(0);
});

test("getScoringGraph + score picks the BooleanEditor for a plain boolean property, using the real widget scoring rules", async () => {
  const scoringGraph = await getScoringGraph("edit");

  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.com/> .
        ex:isActiveShape a sh:PropertyShape ;
            sh:path ex:isActive ;
            sh:datatype xsd:boolean .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.com/> .
        ex:Alice ex:isActive true .
    `,
    "text/turtle",
  );
  const [isActiveQuad] = dataGraph.getQuads(
    factory.namedNode("http://example.com/Alice"),
    factory.namedNode("http://example.com/isActive"),
  );

  const best = await Array.fromAsync(score({
    best: true,
    focusNode: isActiveQuad.object,
    dataGraph,
    shapeNode: factory.namedNode("http://example.com/isActiveShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(best[0]?.widget).toEqual(shui("BooleanEditor"));
});

test("getWidgetComponent resolves a widget IRI to its component for the given mode", () => {
  expect(getWidgetComponent("edit", shui("BooleanEditor"))).toBeDefined();
  expect(getWidgetComponent("view", shui("LiteralViewer"))).toBeDefined();

  // An editor-only widget shouldn't resolve when asked for view mode, and vice versa.
  expect(getWidgetComponent("view", shui("BooleanEditor"))).toBeUndefined();
  expect(getWidgetComponent("edit", shui("LiteralViewer"))).toBeUndefined();
});

test("getWidgetMeta resolves a createTerm override where one is declared", () => {
  expect(getWidgetMeta(shui("BooleanEditor"))?.createTerm).toBeDefined();
});

test("getWidgetMeta returns a meta with no createTerm for widgets whose value shape is shape-derived", () => {
  expect(getWidgetMeta(shui("TextFieldEditor"))?.createTerm).toBeUndefined();
});
