import { expect, test } from "vite-plus/test";
import type { NamedNode } from "@rdfjs/types";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { formatYear, yearOf } from "@/helpers/formatYear.ts";
import { ex, queryPrefixes, xsd } from "@/helpers/namespaces.ts";
import { renderTemplate } from "@/resolution/composeAlternatives.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

const createShape = async ({
  shapes,
  data,
  propertyShapes,
}: {
  shapes: string;
  data: string;
  propertyShapes: NamedNode[];
}) =>
  new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph: await parseRdf(`${queryPrefixes}\n\n${shapes}`, "text/turtle"),
    dataGraph: await parseRdf(`${queryPrefixes}\n\n${data}`, "text/turtle"),
    focusNode: ex("Soren"),
    propertyShapes,
  });

const summaryShape = `
  ex:summary a sh:PropertyShape ;
    sh:path [ sh:alternativePath ( ( ex:citizenship ex:demonym ) ex:occupation ex:born ex:died ) ] ;
    st:mergeAlternatives true ;
    st:mergeTemplate "{0} {1}[ ({2:year}–{3:year})| (born {2:year})| (died {3:year})]" .
`;

const soren = `
  ex:Soren ex:citizenship ex:Denmark ;
    ex:occupation ex:theologian, ex:philosopher, ex:poet ;
    ex:born "1813-05-05T00:00:00Z"^^xsd:dateTime ;
    ex:died "1855-11-11T00:00:00Z"^^xsd:dateTime .
  ex:Denmark ex:demonym "Danish"@en, "Deens"@nl .
  ex:theologian rdfs:label "theologian"@en, "theoloog"@nl .
  ex:philosopher rdfs:label "philosopher"@en, "filosoof"@nl .
  ex:poet rdfs:label "poet"@en, "dichter"@nl .
`;

test("yearOf/formatYear: xsd date literals as a year, astronomical year 0 and before as BCE", () => {
  expect(yearOf(factory.literal("1813-05-05T00:00:00Z", xsd("dateTime")))).toBe(1813);
  expect(yearOf(factory.literal("1813"))).toBeUndefined();
  expect(formatYear(1813)).toBe("1813");
  // Aristotle, born 384 BCE, is written -0383 in XSD 1.1.
  expect(formatYear(yearOf(factory.literal("-0383-01-01T00:00:00Z", xsd("dateTime")))!)).toBe(
    "384 BCE",
  );
});

test("renderTemplate: placeholders, optional sections and whitespace", () => {
  const texts: Record<number, string> = { 0: "Danish", 1: "poet", 2: "1813", 3: "" };
  const textOf = (index: number) => texts[index] ?? "";

  // A section is left out unless every placeholder in it has text.
  expect(renderTemplate("{0} {1}[ ({2}–{3})]", textOf)).toBe("Danish poet");
  // An empty placeholder outside a section leaves no gap.
  expect(renderTemplate("{3} {1}[ ({3})]", textOf)).toBe("poet");
  // A placeholder past the last branch is simply empty.
  expect(renderTemplate("{0}[, {9}]", textOf)).toBe("Danish");
});

test("renderTemplate: a section's variants, the first one complete wins", () => {
  const dates = "{0}[ ({1}–{2})| (born {1})| (died {2})]";
  const render = (texts: string[]) => renderTemplate(dates, (index) => texts[index] ?? "");

  expect(render(["poet", "1813", "1855"])).toBe("poet (1813–1855)");
  expect(render(["poet", "1980", ""])).toBe("poet (born 1980)");
  expect(render(["poet", "", "1855"])).toBe("poet (died 1855)");
  expect(render(["poet", "", ""])).toBe("poet");
  // A variant without placeholders is a default.
  expect(renderTemplate("{0}[ ({1})| (undated)]", (index) => (index === 0 ? "poet" : ""))).toBe(
    "poet (undated)",
  );
});

test("st:mergeAlternatives on the property itself composes one value from the focus node", async () => {
  const shape = await createShape({
    shapes: summaryShape,
    data: soren,
    propertyShapes: [ex("summary")],
  });

  expect(shape.mergesAlternatives()).toBe(true);
  expect(shape.composedObject(["en"])?.value).toBe(
    "Danish theologian, philosopher, and poet (1813–1855)",
  );
  // The values in the content language, joined as a list in it.
  expect(shape.composedObject(["nl"])?.value).toBe(
    "Deens theoloog, filosoof en dichter (1813–1855)",
  );
  // en-GB has no serial comma.
  expect(shape.composedObject(["en-GB"])?.value).toBe(
    "Danish theologian, philosopher and poet (1813–1855)",
  );
});

test("st:mergeAlternatives drops an optional section with no values and composes nothing from nothing", async () => {
  const living = await createShape({
    shapes: summaryShape,
    data: `ex:Soren ex:occupation ex:poet ; ex:born "1950"^^xsd:gYear . ex:poet rdfs:label "poet"@en .`,
    propertyShapes: [ex("summary")],
  });
  expect(living.composedObject(["en"])?.value).toBe("poet (born 1950)");

  const undated = await createShape({
    shapes: summaryShape,
    data: `ex:Soren ex:occupation ex:poet . ex:poet rdfs:label "poet"@en .`,
    propertyShapes: [ex("summary")],
  });
  expect(undated.composedObject(["en"])?.value).toBe("poet");

  const empty = await createShape({
    shapes: summaryShape,
    data: `ex:Soren rdfs:label "Søren" .`,
    propertyShapes: [ex("summary")],
  });
  expect(empty.composedObject(["en"])).toBeUndefined();
});

test("st:mergeTemplate is picked in the best content language", async () => {
  const shape = await createShape({
    shapes: `
      ex:summary a sh:PropertyShape ;
        sh:path [ sh:alternativePath ( ex:occupation ex:born ) ] ;
        st:mergeAlternatives true ;
        st:mergeTemplate "{0}, born {1:year}"@en, "{0}, geboren in {1:year}"@nl .
    `,
    data: soren,
    propertyShapes: [ex("summary")],
  });

  expect(shape.composedObject(["en"])?.value).toBe("theologian, philosopher, and poet, born 1813");
  expect(shape.composedObject(["nl"])?.value).toBe(
    "theoloog, filosoof en dichter, geboren in 1813",
  );
});

test("a property without st:mergeAlternatives composes nothing", async () => {
  const shape = await createShape({
    shapes: `ex:summary a sh:PropertyShape ; sh:path [ sh:alternativePath ( ex:occupation ex:born ) ] .`,
    data: soren,
    propertyShapes: [ex("summary")],
  });

  expect(shape.mergesAlternatives()).toBe(false);
  expect(shape.composedObject(["en"])).toBeUndefined();
});

test("valueNodeLabel step 2: st:mergeTemplate shapes a merged shui:LabelRole label, every value of a branch counting", async () => {
  const shape = await createShape({
    shapes: `
      ex:person a sh:PropertyShape ; sh:path ex:knows ; sh:node [
        sh:property [
          sh:path [ sh:alternativePath ( ex:name ex:occupation ex:born ) ] ;
          shui:propertyRole shui:LabelRole ;
          st:mergeAlternatives true ;
          st:mergeTemplate "{0}[ – {1}][ ({2:year})]" ;
        ] ;
      ] .
    `,
    data: `${soren} ex:Soren ex:name "Søren Kierkegaard" .`,
    propertyShapes: [ex("person")],
  });

  expect(valueNodeLabel({ term: ex("Soren"), propertyShape: shape, languages: ["en"] }).value).toBe(
    "Søren Kierkegaard – theologian, philosopher, and poet (1813)",
  );
});
