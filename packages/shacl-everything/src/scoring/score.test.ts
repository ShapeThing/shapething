import { expect, test } from "vite-plus/test";
import { accept, prepareScoringGraph, score, select } from "@/scoring/score.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, rdf, sh, shui } from "@/helpers/namespaces.ts";

test("returns the single highest-scoring widget when best is true", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetAScore a shui:WidgetScore ;
            shui:widget ex:WidgetA ;
            shui:score 5 .

        ex:widgetBScore a shui:WidgetScore ;
            shui:widget ex:WidgetB ;
            shui:score 9 .
    `,
    "text/turtle",
  );

  const result = await Array.fromAsync(
    select({
      best: true,
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

  expect(result).toBeDefined();
  expect(result[0].value).toBe(ex("WidgetB").value);
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
            shui:widget ex:BooleanWidget ;
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

  const result = await Array.fromAsync(
    score({
      focusNode,
      dataGraph,
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

  expect(result).toHaveLength(0);
});

test("orders matches by descending score, tie-broken by widget IRI, when best is false", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetBScore a shui:WidgetScore ; shui:widget ex:WidgetB ; shui:score 5 .
        ex:widgetAScore a shui:WidgetScore ; shui:widget ex:WidgetA ; shui:score 5 .
        ex:widgetCScore a shui:WidgetScore ; shui:widget ex:WidgetC ; shui:score 9 .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(
    score({
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

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
            shui:widget ex:BooleanWidget ;
            shui:score 20 ;
            shui:dataGraphShape ex:isBoolean .

        ex:textWidgetScore a shui:WidgetScore ;
            shui:widget ex:TextWidget ;
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

  const results = await Array.fromAsync(
    score({
      focusNode,
      dataGraph,
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

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
            shui:widget ex:BooleanWidget ;
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

  const results = await Array.fromAsync(
    score({
      focusNode,
      dataGraph,
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

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
            shui:widget ex:InstancesSelectWidget ;
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

  const results = await Array.fromAsync(
    score({
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("ownerShape"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

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
            shui:widget ex:InstancesSelectWidget ;
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

  const results = await Array.fromAsync(
    score({
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("ownerShape"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

  expect(results.map((result) => result.widget.value)).toEqual([ex("InstancesSelectWidget").value]);
});

test("excludes a widget score that only has a data graph shape when no focus node is given", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:widget ex:SomeWidget ;
            shui:score 5 ;
            shui:dataGraphShape ex:isString .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(
    score({
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

  expect(results).toHaveLength(0);
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
            shui:widget ex:SomeWidget ;
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

  const results = await Array.fromAsync(
    score({
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("ownerShape"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

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
            shui:widget ex:SomeWidget ;
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

  const results = await Array.fromAsync(
    score({
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("ownerShape"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

  expect(results.map((result) => result.widget.value)).toEqual([ex("SomeWidget").value]);
});

test("throws when a widget score definition is missing shui:widget", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:score 5 .
    `,
    "text/turtle",
  );

  await expect(
    Array.fromAsync(
      score({
        focusNode: ex("Alice"),
        dataGraph: await parseRdf("", "text/turtle"),
        shapeNode: ex("SomeShape"),
        shapesGraph: await parseRdf("", "text/turtle"),
        scoringGraph,
        widgetPredicate: shui("editor"),
      }),
    ),
  ).rejects.toThrow("Invalid Widget Score definition");
});

test("throws when a widget score definition has a non-numeric score", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:widget ex:SomeWidget ;
            shui:score "not-a-number" .
    `,
    "text/turtle",
  );

  await expect(
    Array.fromAsync(
      score({
        focusNode: ex("Alice"),
        dataGraph: await parseRdf("", "text/turtle"),
        shapeNode: ex("SomeShape"),
        shapesGraph: await parseRdf("", "text/turtle"),
        scoringGraph,
        widgetPredicate: shui("editor"),
      }),
    ),
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
            shui:widget ex:IRIEditor ;
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

  const results = await Array.fromAsync(
    score({
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("nameShape"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

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
            shui:widget ex:IRIEditor ;
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

  const results = await Array.fromAsync(
    score({
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("ownerShape"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

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
            shui:widget ex:SomeWidget ;
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
    widgetNode: ex("SomeWidget"),
    scoringGraph,
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
            shui:widget ex:IRIEditor ;
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

  const results = await Array.fromAsync(
    score({
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("ownerShape"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

  expect(results).toHaveLength(0);
});

test("prepareScoringGraph - adds a shui:WidgetScore matching Example 7 of the spec for a widget declared via shui:editor with no score of its own", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:PersonShapeName
            a sh:PropertyShape ;
            sh:path ex:name ;
            shui:editor ex:MyCustomEditor ;
        .
    `,
    "text/turtle",
  );

  const prepared = prepareScoringGraph({
    shapesGraph,
    scoringGraph: await parseRdf("", "text/turtle"),
  });

  const [widgetScore] = prepared.getQuads(null, rdf("type"), shui("WidgetScore"));
  expect(widgetScore).toBeDefined();
  expect(prepared.getQuads(widgetScore.subject, shui("widget"))[0]?.object.value).toBe(
    ex("MyCustomEditor").value,
  );
  expect(prepared.getQuads(widgetScore.subject, shui("score"))[0]?.object.value).toBe("40");

  const [shapesGraphShapeQuad] = prepared.getQuads(widgetScore.subject, shui("shapesGraphShape"));
  const nodeShape = shapesGraphShapeQuad.object;
  expect(prepared.getQuads(nodeShape, rdf("type"), sh("NodeShape"))).toHaveLength(1);
  const [propertyQuad] = prepared.getQuads(nodeShape, sh("property"));
  const propertyShape = propertyQuad.object;
  expect(prepared.getQuads(propertyShape, sh("path"))[0]?.object.value).toBe(shui("editor").value);
  expect(prepared.getQuads(propertyShape, sh("hasValue"))[0]?.object.value).toBe(
    ex("MyCustomEditor").value,
  );
});

test("prepareScoringGraph - lets score() return a widget declared via shui:editor with no prior score at all", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:PersonShapeName
            a sh:PropertyShape ;
            sh:path ex:name ;
            shui:editor ex:MyCustomEditor ;
        .
    `,
    "text/turtle",
  );

  const scoringGraph = prepareScoringGraph({
    shapesGraph,
    scoringGraph: await parseRdf("", "text/turtle"),
  });

  const results = await Array.fromAsync(
    score({
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("PersonShapeName"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("editor"),
    }),
  );

  expect(results.map((result) => result.widget.value)).toEqual([ex("MyCustomEditor").value]);
});

test("prepareScoringGraph - leaves a widget scoringGraph already scores untouched, even for the declared case", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:PersonShapeName
            a sh:PropertyShape ;
            sh:path ex:name ;
            shui:editor ex:AlreadyScoredEditor ;
        .
    `,
    "text/turtle",
  );

  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:alreadyScoredEditorScore a shui:WidgetScore ;
            shui:widget ex:AlreadyScoredEditor ;
            shui:score 5 .
    `,
    "text/turtle",
  );

  const prepared = prepareScoringGraph({ shapesGraph, scoringGraph });

  expect(prepared.getQuads(null, shui("widget"), ex("AlreadyScoredEditor"))).toHaveLength(1);
});

test("prepareScoringGraph - ignores a shui:editor value at a node that isn't a shape", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:NotAShape shui:editor ex:SomeOtherWidget .
    `,
    "text/turtle",
  );

  const prepared = prepareScoringGraph({
    shapesGraph,
    scoringGraph: await parseRdf("", "text/turtle"),
  });

  expect(prepared.getQuads(null, rdf("type"), shui("WidgetScore"))).toHaveLength(0);
});

test("prepareScoringGraph - also covers shui:viewer declarations", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:PersonShapeName
            a sh:PropertyShape ;
            sh:path ex:name ;
            shui:viewer ex:MyCustomViewer ;
        .
    `,
    "text/turtle",
  );

  const scoringGraph = prepareScoringGraph({
    shapesGraph,
    scoringGraph: await parseRdf("", "text/turtle"),
  });

  const results = await Array.fromAsync(
    score({
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("PersonShapeName"),
      shapesGraph,
      scoringGraph,
      widgetPredicate: shui("viewer"),
    }),
  );

  expect(results.map((result) => result.widget.value)).toEqual([ex("MyCustomViewer").value]);
});

test("prepareScoringGraph - honors a configured shui:defaultWidgetScore instead of the spec's default of 40", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:PersonShapeName
            a sh:PropertyShape ;
            sh:path ex:name ;
            shui:editor ex:MyCustomEditor ;
        .
    `,
    "text/turtle",
  );

  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:globalConfig shui:defaultWidgetScore 55 .
    `,
    "text/turtle",
  );

  const prepared = prepareScoringGraph({ shapesGraph, scoringGraph });

  const [widgetScore] = prepared.getQuads(null, shui("widget"), ex("MyCustomEditor"));
  expect(prepared.getQuads(widgetScore.subject, shui("score"))[0]?.object.value).toBe("55");
});

test("prepareScoringGraph - is idempotent when applied to an already-prepared scoring graph", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:PersonShapeName
            a sh:PropertyShape ;
            sh:path ex:name ;
            shui:editor ex:MyCustomEditor ;
        .
    `,
    "text/turtle",
  );

  const once = prepareScoringGraph({
    shapesGraph,
    scoringGraph: await parseRdf("", "text/turtle"),
  });
  const twice = prepareScoringGraph({ shapesGraph, scoringGraph: once });

  expect(twice.getQuads(null, rdf("type"), shui("WidgetScore"))).toHaveLength(1);
});
