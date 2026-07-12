import { expect, test } from "vite-plus/test";
import type { NamedNode } from "@rdfjs/types";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes, shui, xsd } from "@/helpers/namespaces.ts";
import { createDefaultTerm, defaultTermFromShape } from "@/widgets/defaultTerm.ts";

const createElement = async (turtle: string, propertyShapes: NamedNode[] = [ex("property1")]) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");
  const dataGraph = await parseRdf("", "text/turtle");
  return new PropertyUIElement({ shapesGraph, dataGraph, focusNode: ex("Alice"), propertyShapes });
};

test("defaultTermFromShape returns a literal typed with the declared sh:datatype", async () => {
  const shape = await createElement(`ex:property1 a sh:PropertyShape ; sh:datatype xsd:date .`);
  const term = defaultTermFromShape(shape);
  expect(term.termType).toEqual("Literal");
  expect(term.value).toEqual("");
  expect((term as { datatype: NamedNode }).datatype).toEqual(xsd("date"));
});

test("defaultTermFromShape returns a NamedNode when sh:nodeKind is unambiguously sh:IRI", async () => {
  const shape = await createElement(`ex:property1 a sh:PropertyShape ; sh:nodeKind sh:IRI .`);
  expect(defaultTermFromShape(shape).termType).toEqual("NamedNode");
});

test("defaultTermFromShape returns a BlankNode when sh:nodeKind is unambiguously sh:BlankNode", async () => {
  const shape = await createElement(`ex:property1 a sh:PropertyShape ; sh:nodeKind sh:BlankNode .`);
  expect(defaultTermFromShape(shape).termType).toEqual("BlankNode");
});

test("defaultTermFromShape treats sh:class as a resource reference when nodeKind is absent", async () => {
  const shape = await createElement(`ex:property1 a sh:PropertyShape ; sh:class ex:Animal .`);
  expect(defaultTermFromShape(shape).termType).toEqual("NamedNode");
});

test("defaultTermFromShape falls back to an xsd:string literal when the shape declares nothing", async () => {
  const shape = await createElement(`ex:property1 a sh:PropertyShape .`);
  const term = defaultTermFromShape(shape);
  expect(term.termType).toEqual("Literal");
  expect((term as { datatype: NamedNode }).datatype).toEqual(xsd("string"));
});

test("createDefaultTerm prefers the widget's own createTerm over the shape-derived default", async () => {
  // BooleanEditor's createTerm always returns a 'false' literal, even though this shape alone
  // (no sh:datatype) would otherwise fall back to a plain xsd:string literal.
  const shape = await createElement(`ex:property1 a sh:PropertyShape .`);
  const term = createDefaultTerm(shui("BooleanEditor"), shape, { contentLanguage: "en-GB" });
  expect(term.value).toEqual("false");
  expect((term as { datatype: NamedNode }).datatype).toEqual(xsd("boolean"));
});

test("createDefaultTerm falls back to defaultTermFromShape for widgets without createTerm", async () => {
  const shape = await createElement(`ex:property1 a sh:PropertyShape ; sh:datatype xsd:string .`);
  const term = createDefaultTerm(shui("TextFieldEditor"), shape, { contentLanguage: "en-GB" });
  expect(term.termType).toEqual("Literal");
  expect((term as { datatype: NamedNode }).datatype).toEqual(xsd("string"));
});

test("createDefaultTerm's EnumSelectEditor picks a NamedNode when sh:in's first member is one", async () => {
  const shape = await createElement(
    `ex:property1 a sh:PropertyShape ; sh:in ( ex:Red ex:Green ex:Blue ) .`,
  );
  const term = createDefaultTerm(shui("EnumSelectEditor"), shape, { contentLanguage: "en-GB" });
  expect(term.termType).toEqual("NamedNode");
});

test("createDefaultTerm's TextFieldWithLangEditor uses the active content language", async () => {
  const shape = await createElement(`ex:property1 a sh:PropertyShape .`);
  const term = createDefaultTerm(shui("TextFieldWithLangEditor"), shape, {
    contentLanguage: "nl-NL",
  });
  expect(term.termType).toEqual("Literal");
  expect((term as { language: string }).language).toEqual("nl-NL");
});
