import { expect, test } from "vite-plus/test";
import type { BlankNode, NamedNode } from "@rdfjs/types";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, queryPrefixes, sh, shui } from "@/helpers/namespaces.ts";

const createElement = async (turtle: string, propertyShapes: NamedNode[]) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");
  const dataGraph = await parseRdf("", "text/turtle");
  return new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
    propertyShapes,
  });
};

test("get() returns an empty array when the predicate is absent", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape .`, [ex("property1")]);
  expect(element.get(sh("minCount"))).toBeUndefined();
});

test("get() passes a single value through unchanged for predicates without a resolution", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; ex:customPredicate "hello" .`,
    [ex("property1")],
  );
  expect(element.get(ex("customPredicate")).map((term) => term.value)).toEqual(["hello"]);
});

test("sh:class keeps only the most specific classes across shapes", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:class ex:Animal .
        ex:property2 a sh:PropertyShape ; sh:class ex:Dog .
        ex:property3 a sh:PropertyShape ; sh:class ex:Boxer .
        ex:property4 a sh:PropertyShape ; sh:class ex:Cat .

        ex:Cat rdfs:subClassOf ex:Animal .
        ex:Dog rdfs:subClassOf ex:Animal .
        ex:Boxer rdfs:subClassOf ex:Dog .
    `,
    [ex("property1"), ex("property2"), ex("property3"), ex("property4")],
  );

  expect(element.get(sh("class")).map((term) => term.value)).toEqual([
    ex("Boxer").value,
    ex("Cat").value,
  ]);
});

test("sh:datatype throws when shapes disagree on an unrelated datatype", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:datatype ex:HumanAge .
        ex:property2 a sh:PropertyShape ; sh:datatype xsd:integer .
        ex:property3 a sh:PropertyShape ; sh:datatype xsd:float .

        ex:HumanAge a rdfs:Datatype ; rdfs:subClassOf xsd:integer .
    `,
    [ex("property1"), ex("property2"), ex("property3")],
  );

  expect(() => element.get(sh("datatype"))).toThrow(
    "Expected a singular value for datatype but found disjoint values: HumanAge, float",
  );
});

test("sh:nodeKind intersects across shapes, including list-form values", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:nodeKind sh:IRI .
        ex:property2 a sh:PropertyShape ; sh:nodeKind sh:BlankNodeOrIRI .
        ex:property3 a sh:PropertyShape ; sh:nodeKind ( sh:IRI ) .
    `,
    [ex("property1"), ex("property2"), ex("property3")],
  );

  expect(element.get(sh("nodeKind")).map((term) => term.value)).toEqual([sh("IRI").value]);
});

test("sh:nodeKind throws when there is no intersection", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:nodeKind sh:Literal .
        ex:property2 a sh:PropertyShape ; sh:nodeKind sh:BlankNodeOrIRI .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(() => element.get(sh("nodeKind"))).toThrow(/No intersection found for sh:nodeKind/);
});

test("sh:minCount and sh:maxCount combine across shapes to the tightest bound", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:minCount 1 ; sh:maxCount 1 .
        ex:property2 a sh:PropertyShape ; sh:minCount 2 ; sh:maxCount 2 .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("minCount"))).toBe(2);
  expect(element.get(sh("maxCount"))).toBe(1);
});

test("sh:minInclusive compares numerically, not lexicographically", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:minInclusive 9 .
        ex:property2 a sh:PropertyShape ; sh:minInclusive 10 .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("minInclusive"))).toBe(10);
});

test("sh:pattern combines differing patterns so a value must match all of them", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:pattern "^[A-Z]" .
        ex:property2 a sh:PropertyShape ; sh:pattern "[0-9]$" .
    `,
    [ex("property1"), ex("property2")],
  );

  const pattern = element.get(sh("pattern"));
  expect(pattern?.test("A1")).toBe(true);
  expect(pattern?.test("A")).toBe(false);
});

test("sh:pattern keeps a single value unchanged", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape ; sh:pattern "^[A-Z]" .`, [
    ex("property1"),
  ]);
  expect(element.get(sh("pattern"))?.source).toBe("^[A-Z]");
});

test("sh:languageIn intersects the declared lists", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:languageIn ( "en" "nl" "de" ) .
        ex:property2 a sh:PropertyShape ; sh:languageIn ( "nl" "fr" ) .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("languageIn")).map((term) => term.value)).toEqual(["nl"]);
});

test("sh:in with a single list still returns the expanded items, not the list node", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:in ( ex:a ex:b ex:c ) .`,
    [ex("property1")],
  );

  expect(element.get(sh("in")).map((term) => term.value)).toEqual([
    ex("a").value,
    ex("b").value,
    ex("c").value,
  ]);
});

test("sh:ignoredProperties merges lists across shapes into a deduplicated set", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:ignoredProperties ( ex:a ex:b ) .
        ex:property2 a sh:PropertyShape ; sh:ignoredProperties ( ex:b ex:c ) .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("ignoredProperties")).map((term) => term.value)).toEqual([
    ex("a").value,
    ex("b").value,
    ex("c").value,
  ]);
});

test("sh:equals resolves when every shape targets the same path", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:equals ex:pathA .
        ex:property2 a sh:PropertyShape ; sh:equals ex:pathA .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("equals"))?.value).toBe(ex("pathA").value);
});

test("sh:equals throws when shapes target different paths", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:equals ex:pathA .
        ex:property2 a sh:PropertyShape ; sh:equals ex:pathB .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(() => element.get(sh("equals"))).toThrow(/Conflicting values for property/);
});

test("sh:disjoint keeps every distinct value in declaration order, deduplicated", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:order 1 ; sh:disjoint ex:pathA .
        ex:property2 a sh:PropertyShape ; sh:order 2 ; sh:disjoint ex:pathB .
        ex:property3 a sh:PropertyShape ; sh:order 3 ; sh:disjoint ex:pathA .
    `,
    [ex("property1"), ex("property2"), ex("property3")],
  );

  expect(element.get(sh("disjoint")).map((term) => term.value)).toEqual([
    ex("pathA").value,
    ex("pathB").value,
  ]);
});

test("sh:hasValue throws when shapes target different values", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:hasValue ex:valueA .
        ex:property2 a sh:PropertyShape ; sh:hasValue ex:valueB .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(() => element.get(sh("hasValue"))).toThrow(
    "Expected a singular value for hasValue but found disjoint values: valueA, valueB",
  );
});

test("sh:name keeps the value from the lowest sh:order shape", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:order 5 ; sh:name "Second name" .
        ex:property2 a sh:PropertyShape ; sh:order 1 ; sh:name "First name" .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("name"))?.value).toBe("First name");
});

test("sh:group keeps the value from the lowest sh:order shape, so a property is never shown in two groups", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:order 5 ; sh:group ex:groupA .
        ex:property2 a sh:PropertyShape ; sh:order 1 ; sh:group ex:groupB .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("group"))?.value).toBe(ex("groupB").value);
});

test("sh:severity keeps the most severe value when shapes disagree", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:severity sh:Info .
        ex:property2 a sh:PropertyShape ; sh:severity sh:Violation .
        ex:property3 a sh:PropertyShape ; sh:severity sh:Warning .
    `,
    [ex("property1"), ex("property2"), ex("property3")],
  );

  expect(element.get(sh("severity"))?.value).toBe(sh("Violation").value);
});

test("sh:severity keeps a single declared value unchanged", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:severity sh:Warning .`,
    [ex("property1")],
  );

  expect(element.get(sh("severity"))?.value).toBe(sh("Warning").value);
});

test("sh:severity is empty when absent, leaving the spec default of sh:Violation to the caller", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape .`, [ex("property1")]);
  expect(element.get(sh("severity"))).toBeUndefined();
});

test("sh:order resolves to the lowest declared order across shapes", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:order 5 .
        ex:property2 a sh:PropertyShape ; sh:order 1 .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("order"))).toBe(1);
});

test("get() returns the first declared value by sh:order", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:order 2 ; sh:name "Second" .
        ex:property2 a sh:PropertyShape ; sh:order 1 ; sh:name "First" .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("name"))?.value).toBe("First");
});

test("get() returns undefined when the predicate is absent", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape .`, [ex("property1")]);
  expect(element.get(sh("name"))).toBeUndefined();
});

test("get() with a language preference prefers the matching sh:name over other languages", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:name "Given name"@en, "Gegeven naam"@nl .`,
    [ex("property1")],
  );

  expect(element.get(sh("name"), ["nl-NL"])?.value).toBe("Gegeven naam");
  expect(element.get(sh("name"), ["en-GB"])?.value).toBe("Given name");
});

test("get() with a language preference falls back to a shared primary subtag", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:name "Gegeven naam"@nl .`,
    [ex("property1")],
  );

  expect(element.get(sh("name"), ["nl-BE"])?.value).toBe("Gegeven naam");
});

test("get() with a language preference falls back to any value when nothing matches", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:name "Given name"@en .`,
    [ex("property1")],
  );

  expect(element.get(sh("name"), ["nl-NL"])?.value).toBe("Given name");
});

test("get() picks the lowest-order shape's name once narrowed to one language", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:order 5 ; sh:name "Second name"@nl .
        ex:property2 a sh:PropertyShape ; sh:order 1 ; sh:name "First name"@nl, "First name (en)"@en .
    `,
    [ex("property1"), ex("property2")],
  );

  expect(element.get(sh("name"), ["nl-NL"])?.value).toBe("First name");
});

test("get() without a language preference is unaffected by language tags", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:name "Given name"@en, "Gegeven naam"@nl .`,
    [ex("property1")],
  );

  expect(element.get(sh("name"))?.value).toBe("Given name");
});

test("label() prefers sh:name over the ontology's rdfs:label", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:name "Given name" .
        ex:givenName rdfs:label "First name" .
    `,
    [ex("property1")],
  );

  expect(element.label()).toBe("Given name");
});

test("label() falls back to the ontology's rdfs:label when sh:name is absent", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path ex:givenName .
        ex:givenName rdfs:label "Given name"@en, "Gegeven naam"@nl .
    `,
    [ex("property1")],
  );

  expect(element.label()).toBe("Given name");
  expect(element.label(["nl-NL"])).toBe("Gegeven naam");
});

test("label() uses the terminal predicate's rdfs:label for a sequence path", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path ( ex:address ex:city ) .
        ex:address rdfs:label "Address" .
        ex:city rdfs:label "City" .
    `,
    [ex("property1")],
  );

  expect(element.label()).toBe("City");
});

test("label() falls back to the property shape's own local name for an alternative path", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path [ sh:alternativePath ( ex:givenName ex:familyName ) ] .
        ex:givenName rdfs:label "Given name" .
        ex:familyName rdfs:label "Family name" .
    `,
    [ex("property1")],
  );

  expect(element.label()).toBe("property1");
});

test("label() honors a globally configured shui:languagePreference when no explicit languages are passed", async () => {
  const element = await createElement(
    `
        ex:config a shui:Configuration ; shui:languagePreference ( "nl" "en" ) .
        ex:property1 a sh:PropertyShape ; sh:path ex:givenName .
        ex:givenName rdfs:label "Given name"@en, "Gegeven naam"@nl .
    `,
    [ex("property1")],
  );

  expect(element.label()).toBe("Gegeven naam");
});

test("label() falls back to the ontology term's local name when neither sh:name nor an rdfs:label exists", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape ; sh:path ex:givenName .`, [
    ex("property1"),
  ]);

  expect(element.label()).toBe("givenName");
});

test("label() prefers the ontology's rdfs:label in the interface language over sh:name in a different language", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:name "Given name"@en .
        ex:givenName rdfs:label "Gegeven naam"@nl .
    `,
    [ex("property1")],
  );

  expect(element.label(["nl-NL"])).toBe("Gegeven naam");
  expect(element.label(["en-GB"])).toBe("Given name");
});

test("label() falls back to sh:name in a different language when the ontology has no label at all", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:name "Given name"@en .`,
    [ex("property1")],
  );

  expect(element.label(["nl-NL"])).toBe("Given name");
});

test("label() still uses a language-less sh:name regardless of interface language", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:name "Given name" .
        ex:givenName rdfs:label "Gegeven naam"@nl .
    `,
    [ex("property1")],
  );

  expect(element.label(["nl-NL"])).toBe("Given name");
});

test("description() returns undefined when neither sh:description nor an rdfs:comment exists", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape ; sh:path ex:givenName .`, [
    ex("property1"),
  ]);

  expect(element.description()).toBeUndefined();
});

test("description() prefers sh:description over the ontology's rdfs:comment", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:description "A given name" .
        ex:givenName rdfs:comment "The person's first name" .
    `,
    [ex("property1")],
  );

  expect(element.description()).toBe("A given name");
});

test("description() falls back to the ontology's rdfs:comment when sh:description is absent", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path ex:givenName .
        ex:givenName rdfs:comment "A given name"@en, "Een voornaam"@nl .
    `,
    [ex("property1")],
  );

  expect(element.description(["en-GB"])).toBe("A given name");
  expect(element.description(["nl-NL"])).toBe("Een voornaam");
});

test("description() prefers the ontology's rdfs:comment in the interface language over sh:description in a different language", async () => {
  const element = await createElement(
    `
        ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:description "A given name"@en .
        ex:givenName rdfs:comment "Een voornaam"@nl .
    `,
    [ex("property1")],
  );

  expect(element.description(["nl-NL"])).toBe("Een voornaam");
  expect(element.description(["en-GB"])).toBe("A given name");
});

test("description() falls back to sh:description in a different language when the ontology has no comment at all", async () => {
  const element = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:path ex:givenName ; sh:description "A given name"@en .`,
    [ex("property1")],
  );

  expect(element.description(["nl-NL"])).toBe("A given name");
});

test("widget() returns undefined when scoresGraph has no matching widget score", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape .`, [ex("property1")]);
  expect(
    await element.widget({
      widgetPredicate: shui("editor"),
    }),
  ).toBeUndefined();
});

test("widget() returns the highest-scoring widget for the property shape alone", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:property1 a sh:PropertyShape ; sh:datatype xsd:boolean .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");
  const scoresGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:hasBooleanDatatype a sh:NodeShape ;
            sh:property [ sh:path sh:datatype ; sh:hasValue xsd:boolean ] .

        ex:booleanWidgetScore a shui:WidgetScore ;
            shui:widget ex:BooleanWidget ;
            shui:score 20 ;
            shui:shapesGraphShape ex:hasBooleanDatatype .

        ex:textWidgetScore a shui:WidgetScore ;
            shui:widget ex:TextWidget ;
            shui:score 5 .
    `,
    "text/turtle",
  );

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    scoresGraph,
    focusNode: ex("Alice"),
    propertyShapes: [ex("property1")],
  });

  expect(
    (
      await element.widget({
        widgetPredicate: shui("editor"),
      })
    )?.value,
  ).toEqual(ex("BooleanWidget").value);
});

test("widget() also scores the given value against shui:dataGraphShape", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:property1 a sh:PropertyShape .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:Alice ex:isActive true .`,
    "text/turtle",
  );
  const scoresGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:isBoolean a sh:NodeShape ; sh:datatype xsd:boolean .

        ex:booleanWidgetScore a shui:WidgetScore ;
            shui:widget ex:BooleanWidget ;
            shui:score 20 ;
            shui:dataGraphShape ex:isBoolean .
    `,
    "text/turtle",
  );

  const [isActiveQuad] = dataGraph.getQuads(ex("Alice"), ex("isActive"));

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    scoresGraph,
    focusNode: ex("Alice"),
    propertyShapes: [ex("property1")],
  });

  expect(
    (
      await element.widget({
        widgetPredicate: shui("editor"),
        valueNode: isActiveQuad.object,
      })
    )?.value,
  ).toEqual(ex("BooleanWidget").value);
});

test("widget() merges grouped property shapes, so a widget hint on either shape is honored", async () => {
  // Mirrors get()'s "conjunctive across grouped shapes" behaviour: propertyShapes[0] alone
  // (ex:minShape) carries no shui:editor hint, so this only passes if both shapes' triples are
  // merged onto one node before scoring.
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:minShape a sh:PropertyShape ; sh:minCount 1 .
        ex:editorShape a sh:PropertyShape ; shui:editor ex:CustomWidget .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");
  const scoresGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
        @prefix ex: <http://example.org/> .

        ex:prefersCustomWidget a sh:NodeShape ;
            sh:property [ sh:path shui:editor ; sh:hasValue ex:CustomWidget ] .

        ex:customWidgetScore a shui:WidgetScore ;
            shui:widget ex:CustomWidget ;
            shui:score 40 ;
            shui:shapesGraphShape ex:prefersCustomWidget .
    `,
    "text/turtle",
  );

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    scoresGraph,
    focusNode: ex("Alice"),
    propertyShapes: [ex("minShape"), ex("editorShape")],
  });

  expect(
    (
      await element.widget({
        widgetPredicate: shui("editor"),
      })
    )?.value,
  ).toEqual(ex("CustomWidget").value);
});

test("getObjects() walks this element's path through the data graph from this.focusNode", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:Alice ex:name "Alice" .`,
    "text/turtle",
  );

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
    propertyShapes: [ex("nameShape")],
  });

  expect(element.getObjects().map((term) => term.value)).toEqual(["Alice"]);
});

test("getObjects() returns an empty array when the property shape has no sh:path", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape .`, [ex("property1")]);
  expect(element.getObjects()).toEqual([]);
});

test("addObject() writes a new value onto this.focusNode via this element's path, on top of any existing ones", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:Alice ex:name "Alice" .`,
    "text/turtle",
  );

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
    propertyShapes: [ex("nameShape")],
  });

  element.addObject(factory.literal("Ally"));

  expect(
    element
      .getObjects()
      .map((term) => term.value)
      .sort(),
  ).toEqual(["Ally", "Alice"].sort());
});

test("addObject() writes onto a BlankNode this.focusNode too, not just a NamedNode (e.g. a nested sh:node value)", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:streetShape a sh:PropertyShape ; sh:path ex:street .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n _:address ex:street "Dam 1" .`,
    "text/turtle",
  );
  const focusNode = dataGraph.getQuads(null, ex("street"))[0].subject as BlankNode;

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode,
    propertyShapes: [ex("streetShape")],
  });

  element.addObject(factory.literal("Dam 2"));

  expect(
    element
      .getObjects()
      .map((term) => term.value)
      .sort(),
  ).toEqual(["Dam 1", "Dam 2"].sort());
});

test("addObject() does nothing when the property shape has no sh:path", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape .`, [ex("property1")]);
  element.addObject(factory.literal("hello"));
  expect(element.getObjects()).toEqual([]);
});

test("replaceObject() swaps an existing value on this.focusNode via this element's path", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:Alice ex:name "Alice" .`,
    "text/turtle",
  );

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
    propertyShapes: [ex("nameShape")],
  });

  element.replaceObject(factory.literal("Alice"), factory.literal("Alicia"));

  expect(element.getObjects().map((term) => term.value)).toEqual(["Alicia"]);
});

test("replaceObject() does nothing when the property shape has no sh:path", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape .`, [ex("property1")]);
  element.replaceObject(factory.literal("hello"), factory.literal("world"));
  expect(element.getObjects()).toEqual([]);
});

test("removeObject() removes an existing value from this.focusNode via this element's path", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:Alice ex:name "Alice", "Ally" .`,
    "text/turtle",
  );

  const element = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
    propertyShapes: [ex("nameShape")],
  });

  element.removeObject(factory.literal("Alice"));

  expect(element.getObjects().map((term) => term.value)).toEqual(["Ally"]);
});

test("removeObject() does nothing when the property shape has no sh:path", async () => {
  const element = await createElement(`ex:property1 a sh:PropertyShape .`, [ex("property1")]);
  element.removeObject(factory.literal("hello"));
  expect(element.getObjects()).toEqual([]);
});
