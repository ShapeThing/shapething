import { expect, test } from "vite-plus/test";
import { score } from "@/scoring/score.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, shui } from "@/helpers/namespaces.ts";

test("returns the single highest-scoring widget when best is true", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

        ex:widgetAScore a shui:WidgetScore ;
            shui:widget ex:WidgetA ;
            shui:score 5 .

        ex:widgetBScore a shui:WidgetScore ;
            shui:widget ex:WidgetB ;
            shui:score 9 .
    `,
    "text/turtle",
  );

  const result = await Array.fromAsync(score({
    best: true,
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(result).toBeDefined();
  expect(result.length).toEqual(1);
  expect(result?.[0]?.widget).toEqual(ex("WidgetB"));
});

test("returns undefined when best is true and no widget matches", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );
  const [nameQuad] = dataGraph.getQuads(ex("Alice"), ex("name"));
  const focusNode = nameQuad.object;

  const result = await Array.fromAsync(score({
    best: true,
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(result).toHaveLength(0);
});

test("orders matches by descending score, tie-broken by widget IRI, when best is false", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

        ex:widgetBScore a shui:WidgetScore ; shui:widget ex:WidgetB ; shui:score 5 .
        ex:widgetAScore a shui:WidgetScore ; shui:widget ex:WidgetA ; shui:score 5 .
        ex:widgetCScore a shui:WidgetScore ; shui:widget ex:WidgetC ; shui:score 9 .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(score({
    best: false,
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

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
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );
  // The literal value being scored - a plain string, so it does not conform to ex:isBoolean.
  const [nameQuad] = dataGraph.getQuads(ex("Alice"), ex("name"));
  const focusNode = nameQuad.object;

  const results = await Array.fromAsync(score({
    best: false,
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results.map((result) => result.widget.value)).toEqual([
    ex("TextWidget").value,
  ]);
});

test("includes a widget whose data graph shape does conform to a literal value", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        ex:Alice ex:isActive true .
    `,
    "text/turtle",
  );
  const [isActiveQuad] = dataGraph.getQuads(ex("Alice"), ex("isActive"));
  const focusNode = isActiveQuad.object;

  const results = await Array.fromAsync(score({
    best: false,
    focusNode,
    dataGraph,
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results.map((result) => result.widget.value)).toEqual([
    ex("BooleanWidget").value,
  ]);
});

test("excludes widgets whose shapes graph shape does not conform to the property shape", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(score({
    best: false,
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results).toHaveLength(0);
});

test("includes a widget whose shapes graph shape does conform to the property shape", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(score({
    best: false,
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results.map((result) => result.widget.value)).toEqual([
    ex("InstancesSelectWidget").value,
  ]);
});

test("excludes a widget score that only has a data graph shape when no focus node is given", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:widget ex:SomeWidget ;
            shui:score 5 ;
            shui:dataGraphShape ex:isString .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(score({
    best: false,
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("SomeShape"),
    shapesGraph: await parseRdf("", "text/turtle"),
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results).toHaveLength(0);
});

test("includes a widget score with only a shapes graph shape when no focus node is given", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(score({
    best: false,
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results.map((result) => result.widget.value)).toEqual([
    ex("SomeWidget").value,
  ]);
});

test("throws when a widget score definition is missing shui:widget", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:score 5 .
    `,
    "text/turtle",
  );

  await expect(
    Array.fromAsync(score({
      best: false,
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    })),
  ).rejects.toThrow("Invalid Widget Score definition");
});

test("throws when a widget score definition has a non-numeric score", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

        ex:widgetScore a shui:WidgetScore ;
            shui:widget ex:SomeWidget ;
            shui:score "not-a-number" .
    `,
    "text/turtle",
  );

  await expect(
    Array.fromAsync(score({
      best: false,
      focusNode: ex("Alice"),
      dataGraph: await parseRdf("", "text/turtle"),
      shapeNode: ex("SomeShape"),
      shapesGraph: await parseRdf("", "text/turtle"),
      scoringGraph,
      widgetPredicate: shui("editor"),
    })),
  ).rejects.toThrow("Invalid Widget Score definition");
});

test("includes a widget whose shapes graph shape uses sh:not when the property shape has no sh:class", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        ex:nameShape a sh:PropertyShape ;
            sh:path ex:name ;
            sh:nodeKind sh:IRI .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(score({
    best: false,
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("nameShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results.map((result) => result.widget.value)).toEqual([
    ex("IRIEditor").value,
  ]);
});

test("excludes a widget whose shapes graph shape uses sh:not when the property shape has sh:class", async () => {
  const scoringGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:nodeKind sh:IRI ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(score({
    best: false,
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results).toHaveLength(0);
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
        @prefix ex: <http://example.com/> .

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
        @prefix ex: <http://example.com/> .
        ex:ownerShape a sh:PropertyShape ;
            sh:path ex:owner ;
            sh:nodeKind sh:IRI ;
            sh:class ex:Person .
    `,
    "text/turtle",
  );

  const results = await Array.fromAsync(score({
    best: false,
    focusNode: ex("Alice"),
    dataGraph: await parseRdf("", "text/turtle"),
    shapeNode: ex("ownerShape"),
    shapesGraph,
    scoringGraph,
    widgetPredicate: shui("editor"),
  }));

  expect(results).toHaveLength(0);
});
