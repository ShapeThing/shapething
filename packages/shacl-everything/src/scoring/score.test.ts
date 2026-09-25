import { expect, test } from "vite-plus/test";
import { accept, score, select } from "@/scoring/score.ts";
import { validate } from "@/validation/validate.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes, shui } from "@/helpers/namespaces.ts";
import { defaultWidgets, getScoringGraph } from "@/widgets/registry.ts";
import { factory } from "@/helpers/factory.ts";

test("returns the single highest-scoring widget when best is true", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetAScore a shui:WidgetScore ;
            shui:editor ex:WidgetA ;
            shui:score 5 .

        ex:widgetBScore a shui:WidgetScore ;
            shui:editor ex:WidgetB ;
            shui:score 9 .
    `,
    "text/turtle",
  );

  const result = await select({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(result).toBeDefined();
  expect(result?.value).toBe(ex("WidgetB").value);
});

test("returns undefined when best is true and no widget matches", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:isBoolean a sh:NodeShape ;
            sh:datatype xsd:boolean .

        ex:booleanWidgetScore a shui:WidgetScore ;
            shui:editor ex:BooleanWidget ;
            shui:score 20 ;
            shui:dataGraphShape ex:isBoolean .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );
  const [nameQuad] = dataGraph.getQuads(ex("Alice"), ex("name"));
  const focusNode = nameQuad.object;

  const result = await score({
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(result).toHaveLength(0);
});

test("orders matches by descending score, tie-broken by widget IRI, when best is false", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetBScore a shui:WidgetScore ; shui:editor ex:WidgetB ; shui:score 5 .
        ex:widgetAScore a shui:WidgetScore ; shui:editor ex:WidgetA ; shui:score 5 .
        ex:widgetCScore a shui:WidgetScore ; shui:editor ex:WidgetC ; shui:score 9 .
    `,
    "text/turtle",
  );

  const results = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results.map((result) => result.widget.value)).toEqual([
    ex("WidgetC").value,
    ex("WidgetA").value,
    ex("WidgetB").value,
  ]);
});

test("excludes widgets whose data graph shape does not conform to the value, even when best is false", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:isBoolean a sh:NodeShape ;
            sh:datatype xsd:boolean .

        ex:booleanWidgetScore a shui:WidgetScore ;
            shui:editor ex:BooleanWidget ;
            shui:score 20 ;
            shui:dataGraphShape ex:isBoolean .

        ex:textWidgetScore a shui:WidgetScore ;
            shui:editor ex:TextWidget ;
            shui:score 5 .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );
  // The literal value being scored - a plain string, so it does not conform to ex:isBoolean.
  const [nameQuad] = dataGraph.getQuads(ex("Alice"), ex("name"));
  const focusNode = nameQuad.object;

  const results = await score({
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results.map((result) => result.widget.value)).toEqual([ex("TextWidget").value]);
});

test("includes a widget whose data graph shape does conform to a literal value", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:isBoolean a sh:NodeShape ;
            sh:datatype xsd:boolean .

        ex:booleanWidgetScore a shui:WidgetScore ;
            shui:editor ex:BooleanWidget ;
            shui:score 20 ;
            shui:dataGraphShape ex:isBoolean .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        ex:Alice ex:isActive true .
    `,
    "text/turtle",
  );
  const [isActiveQuad] = dataGraph.getQuads(ex("Alice"), ex("isActive"));
  const focusNode = isActiveQuad.object;

  const results = await score({
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results.map((result) => result.widget.value)).toEqual([ex("BooleanWidget").value]);
});

test("excludes widgets whose shapes graph shape does not conform to the property shape", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:hasClassConstraint a sh:NodeShape ;
            sh:property [
                sh:path sh:class ;
                sh:minCount 1 ;
            ] .

        ex:instancesSelectScore a shui:WidgetScore ;
            shui:editor ex:InstancesSelectWidget ;
            shui:score 15 ;
            shui:shapesGraphShape ex:hasClassConstraint .
    `,
    "text/turtle",
  );

  // A property shape with no sh:class - does not conform to ex:hasClassConstraint.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner .
    `,
    "text/turtle",
  );

  const results = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results).toHaveLength(0);
});

test("includes a widget whose shapes graph shape does conform to the property shape", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:hasClassConstraint a sh:NodeShape ;
            sh:property [
                sh:path sh:class ;
                sh:minCount 1 ;
            ] .

        ex:instancesSelectScore a shui:WidgetScore ;
            shui:editor ex:InstancesSelectWidget ;
            shui:score 15 ;
            shui:shapesGraphShape ex:hasClassConstraint .
    `,
    "text/turtle",
  );

  // A property shape with sh:class - conforms to ex:hasClassConstraint.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results.map((result) => result.widget.value)).toEqual([ex("InstancesSelectWidget").value]);
});

test("excludes a widget score that only has a data graph shape when no focus node is given", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:editor ex:SomeWidget ;
            shui:score 5 ;
            shui:dataGraphShape ex:isString .
    `,
    "text/turtle",
  );

  const results = await score({
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results).toHaveLength(0);
});

test("validate conforms a genuine sh:nodeKind check against a focus node absent from the target graph", async () => {
  // Mirrors widgets/defaultTerm.ts's defaultTermFromShape(): an in-memory-only placeholder term
  // (e.g. factory.namedNode("")) used to re-resolve a widget for an unset property, never written
  // into dataGraph - validate() must check it for real against shapeNode, not auto-reject it
  // purely for being absent from the graph.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        ex:isIRI a sh:NodeShape ; sh:nodeKind sh:IRI .
    `,
    "text/turtle",
  );

  // Non-empty, but the focus nodes below appear nowhere in it - as subject or object.
  const targetGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );

  const placeholderIRI = factory.namedNode("");
  expect(
    await validate({ focusNode: placeholderIRI, targetGraph, shapeNode: ex("isIRI"), shapesGraph }),
  ).toBe(true);

  // Proves this now validates real sh:nodeKind semantics, not "anything absent passes": a
  // disconnected BlankNode genuinely does not conform to sh:nodeKind sh:IRI.
  const placeholderBlankNode = factory.blankNode();
  expect(
    await validate({
      focusNode: placeholderBlankNode,
      targetGraph,
      shapeNode: ex("isIRI"),
      shapesGraph,
    }),
  ).toBe(false);
});

test("includes a widget whose data graph shape conforms to a focus node absent from the target graph", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:isIRI a sh:NodeShape ; sh:nodeKind sh:IRI .

        ex:iriWidgetScore a shui:WidgetScore ;
            shui:editor ex:IRIWidget ;
            shui:score 20 ;
            shui:dataGraphShape ex:isIRI .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );
  // Never written into dataGraph - e.g. defaultTermFromShape()'s placeholder term.
  const focusNode = factory.namedNode("");

  const results = await score({
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results.map((result) => result.widget.value)).toEqual([ex("IRIWidget").value]);
});

test("accept returns true for a WidgetAcceptMatcher whose data graph shape conforms to a focus node absent from the target graph", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:isIRI a sh:NodeShape ; sh:nodeKind sh:IRI .

        ex:someWidgetAcceptMatcher a shui:WidgetAcceptMatcher ;
            shui:editor ex:SomeWidget ;
            shui:dataGraphShape ex:isIRI .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );
  const focusNode = factory.namedNode("");

  const result = await accept({
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    widgetIRI: ex("SomeWidget"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(result).toBe(true);
});

test("includes a widget score that combines a data graph shape with a shapes graph shape when no focus node is given, once its shapes graph shape half passes", async () => {
  // Per spec (Matcher Function, step 1 & 4): the no-focus-node early exclusion only applies to a
  // rule with a dataGraphShape and *no* shapesGraphShape at all - a rule combining both (e.g. a
  // built-in editor's own score.ttl band-40 rule pairing shui:editor's shapesGraphShape check
  // with a dataGraphShape type check) matches on its shapesGraphShape half alone once there's no
  // value to check the dataGraphShape half against, so an explicitly-declared editor still shows
  // up before any value exists.
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:isString a sh:NodeShape ;
            sh:datatype xsd:string .

        ex:hasClassConstraint a sh:NodeShape ;
            sh:property [
                sh:path sh:class ;
                sh:minCount 1 ;
            ] .

        ex:widgetScore a shui:WidgetScore ;
            shui:editor ex:SomeWidget ;
            shui:score 30 ;
            shui:dataGraphShape ex:isString ;
            shui:shapesGraphShape ex:hasClassConstraint .
    `,
    "text/turtle",
  );

  // A property shape that DOES conform to the shapesGraphShape half (sh:class) - only the
  // dataGraphShape half (isString) is left unverifiable with no focus node.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await score({
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results.map((result) => result.widget.value)).toEqual([ex("SomeWidget").value]);
});

test("includes a widget score with only a shapes graph shape when no focus node is given", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:hasClassConstraint a sh:NodeShape ;
            sh:property [
                sh:path sh:class ;
                sh:minCount 1 ;
            ] .

        ex:widgetScore a shui:WidgetScore ;
            shui:editor ex:SomeWidget ;
            shui:score 5 ;
            shui:shapesGraphShape ex:hasClassConstraint .
    `,
    "text/turtle",
  );

  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await score({
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results.map((result) => result.widget.value)).toEqual([ex("SomeWidget").value]);
});

test("excludes a widget score definition with no value under the current widgetPredicate, rather than throwing", async () => {
  // A WidgetScore with no shui:editor (or shui:viewer/st:facet) value isn't malformed data - it's
  // simply a different category's rule sharing this scoringGraph (see resolveScoresGraph's
  // edit+view union for readOnlyGraph), so it's silently excluded rather than treated as an error.
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:score 5 .
    `,
    "text/turtle",
  );

  const results = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results).toHaveLength(0);
});

test("scores only the current category's rules when a scoringGraph unions more than one category (e.g. edit+view for readOnlyGraph)", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:editorWidgetScore a shui:WidgetScore ;
            shui:editor ex:TextFieldEditor ;
            shui:score 30 .

        ex:viewerWidgetScore a shui:WidgetScore ;
            shui:viewer ex:LiteralViewer ;
            shui:score 30 .
    `,
    "text/turtle",
  );

  const editorResults = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });
  expect(editorResults.map((result) => result.widget.value)).toEqual([ex("TextFieldEditor").value]);

  const viewerResults = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("viewer"),
  });
  expect(viewerResults.map((result) => result.widget.value)).toEqual([ex("LiteralViewer").value]);
});

test("throws when a widget score definition has widgetPredicate but no shui:score", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:editor ex:SomeWidget .
    `,
    "text/turtle",
  );

  await expect(
    score({
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  ).rejects.toThrow("Invalid Widget Score definition");
});

test("throws when a widget score definition has a non-numeric score", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:editor ex:SomeWidget ;
            shui:score "not-a-number" .
    `,
    "text/turtle",
  );

  await expect(
    score({
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  ).rejects.toThrow("Invalid Widget Score definition");
});

test("includes a widget whose shapes graph shape uses sh:not when the property shape has no sh:class", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:hasClassConstraint a sh:NodeShape ;
            sh:property [
                sh:path sh:class ;
                sh:minCount 1 ;
            ] .

        ex:hasNoClassConstraint a sh:NodeShape ;
            sh:not ex:hasClassConstraint .

        ex:iriEditorScore a shui:WidgetScore ;
            shui:editor ex:IRIEditor ;
            shui:score 10 ;
            shui:shapesGraphShape ex:hasNoClassConstraint .
    `,
    "text/turtle",
  );

  // Property shape with no sh:class - should conform to ex:hasNoClassConstraint.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        ex:nameShape a sh:PropertyShape ;
            sh:path ex:name ;
            sh:nodeKind sh:IRI .
    `,
    "text/turtle",
  );

  const results = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("nameShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results.map((result) => result.widget.value)).toEqual([ex("IRIEditor").value]);
});

test("excludes a widget whose shapes graph shape uses sh:not when the property shape has sh:class", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:hasClassConstraint a sh:NodeShape ;
            sh:property [
                sh:path sh:class ;
                sh:minCount 1 ;
            ] .

        ex:hasNoClassConstraint a sh:NodeShape ;
            sh:not ex:hasClassConstraint .

        ex:iriEditorScore a shui:WidgetScore ;
            shui:editor ex:IRIEditor ;
            shui:score 10 ;
            shui:shapesGraphShape ex:hasNoClassConstraint .
    `,
    "text/turtle",
  );

  // Property shape WITH sh:class - should NOT conform to ex:hasNoClassConstraint.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:nodeKind sh:IRI ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results).toHaveLength(0);
});

test("accept returns false for a WidgetAcceptMatcher whose shape can never conform", async () => {
  // An empty shape has no constraints, so every node conforms to it - negating it with sh:not
  // means no node, regardless of value, can ever conform to ex:neverConforms.
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:neverConforms a sh:NodeShape ;
            sh:not [ a sh:NodeShape ] .

        ex:someWidgetAcceptMatcher a shui:WidgetAcceptMatcher ;
            shui:editor ex:SomeWidget ;
            shui:dataGraphShape ex:neverConforms .
    `,
    "text/turtle",
  );

  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.org/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );
  const [nameQuad] = dataGraph.getQuads(ex("Alice"), ex("name"));
  const focusNode = nameQuad.object;

  const result = await accept({
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    widgetIRI: ex("SomeWidget"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(result).toBe(false);
});

test("excludes a widget when the property shape has sh:class, even when sh:not is combined with another shapesGraphShape", async () => {
  // This tests the multi-shapesGraphShape scenario that matches the real IRIEditor score.ttl:
  //   shui:shapesGraphShape shui:hasNodeKindIRIConstraint, shui:hasNoClassConstraint ;
  // Both constraints must be satisfied — a shape with sh:nodeKind sh:IRI but also sh:class
  // should NOT match, because hasNoClassConstraint (sh:not hasClassConstraint) is violated.
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:hasNodeKindIRIConstraint a sh:NodeShape ;
            sh:property [
                sh:path sh:nodeKind ;
                sh:minCount 1 ;
                sh:hasValue sh:IRI ;
            ] .

        ex:hasClassConstraint a sh:NodeShape ;
            sh:property [
                sh:path sh:class ;
                sh:minCount 1 ;
            ] .

        ex:hasNoClassConstraint a sh:NodeShape ;
            sh:not ex:hasClassConstraint .

        ex:iriEditorScore a shui:WidgetScore ;
            shui:editor ex:IRIEditor ;
            shui:score 10 ;
            shui:shapesGraphShape ex:hasNodeKindIRIConstraint, ex:hasNoClassConstraint .
    `,
    "text/turtle",
  );

  // Property shape with sh:nodeKind sh:IRI AND sh:class — satisfies hasNodeKindIRIConstraint
  // but violates hasNoClassConstraint.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:nodeKind sh:IRI ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await score({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(results).toHaveLength(0);
});

test("select() breaks an equal-score tie by widget IRI, not by the order rules appear in the scoring graph", async () => {
  // Declared B-before-A on purpose: store/quad order must not decide the winner.
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetBScore a shui:WidgetScore ; shui:editor ex:WidgetB ; shui:score 5 .
        ex:widgetAScore a shui:WidgetScore ; shui:editor ex:WidgetA ; shui:score 5 .
        ex:widgetCScore a shui:WidgetScore ; shui:editor ex:WidgetC ; shui:score 1 .
    `,
    "text/turtle",
  );

  const result = await select({
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  });

  expect(result?.value).toBe(ex("WidgetA").value);
});

// The bundled editors' own score.ttl rules, end to end: each case below is a genuine tie at the top
// score between two built-in editors, decided only by IRI order.
async function selectBundledEditor(propertyShapeTurtle: string, valueTurtle: string) {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}
    ex:property ${propertyShapeTurtle} .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(`${queryPrefixes}\nex:Alice ex:value ${valueTurtle} .`, "text/turtle");
  const [valueQuad] = dataGraph.getQuads(ex("Alice"), ex("value"));
  return select({
    focusNode: valueQuad.object,
    dataGraph,
    shapeNode: ex("property"),
    shapesGraph,
    scoringGraph: await getScoringGraph("edit", defaultWidgets),
    widgetPredicate: shui("editor"),
  });
}

test("select() picks TextAreaEditor over TextFieldEditor (both 30) for a sh:singleLine false string", async () => {
  const result = await selectBundledEditor(
    `sh:path ex:value ; sh:datatype xsd:string ; sh:singleLine false`,
    `"Some text"`,
  );
  expect(result?.value).toBe(shui("TextAreaEditor").value);
});

test("select() still picks TextFieldEditor for a plain string with no sh:singleLine false", async () => {
  const result = await selectBundledEditor(`sh:path ex:value ; sh:datatype xsd:string`, `"Some text"`);
  expect(result?.value).toBe(shui("TextFieldEditor").value);
});

test("select() picks TextAreaWithLangEditor over TextFieldWithLangEditor (both 30) for a sh:singleLine false langString", async () => {
  const result = await selectBundledEditor(
    `sh:path ex:value ; sh:datatype rdf:langString ; sh:singleLine false`,
    `"Some text"@en`,
  );
  expect(result?.value).toBe(shui("TextAreaWithLangEditor").value);
});

test("select() picks AutoCompleteEditor over EnumSelectEditor/InstancesSelectEditor (all 40) for a sh:class IRI value", async () => {
  const result = await selectBundledEditor(
    `sh:path ex:value ; sh:class ex:Person ; sh:nodeKind sh:IRI`,
    `ex:Bob`,
  );
  expect(result?.value).toBe(shui("AutoCompleteEditor").value);
});
