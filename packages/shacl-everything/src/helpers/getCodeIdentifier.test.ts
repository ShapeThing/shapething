import { expect, test } from "vite-plus/test";
import { getCodeIdentifier } from "@/helpers/getCodeIdentifier.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

function parse(turtle: string) {
  return parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ${turtle}
    `,
    "text/turtle",
  );
}

test("getCodeIdentifier - prefers an explicit sh:codeIdentifier over everything else", async () => {
  const shapesGraph = await parse(`
        ex:aShape a sh:PropertyShape ;
            sh:codeIdentifier "customId" ;
            sh:path ex:otherName ;
            sh:name "Display Name"@en ;
        .
    `);

  expect(getCodeIdentifier(shapesGraph, ex("aShape"))).toEqual("customId");
});

test("getCodeIdentifier - falls back to the local name of sh:path when there is no codeIdentifier", async () => {
  const shapesGraph = await parse(`
        ex:aShape a sh:PropertyShape ;
            sh:path ex:someProperty ;
            sh:name "Display Name"@en ;
        .
    `);

  expect(getCodeIdentifier(shapesGraph, ex("aShape"))).toEqual("someProperty");
});

test("getCodeIdentifier - falls back to sh:name (in English) when the path is not a simple predicate", async () => {
  const shapesGraph = await parse(`
        ex:aShape a sh:PropertyShape ;
            sh:path [ sh:inversePath ex:parent ] ;
            sh:name "Weergavenaam"@nl ;
            sh:name "Display Name"@en ;
        .
    `);

  expect(getCodeIdentifier(shapesGraph, ex("aShape"))).toEqual("Display Name");
});

test("getCodeIdentifier - resolves sh:name in English regardless of the shape node's own IRI", async () => {
  const shapesGraph = await parse(`
        ex:aShape a sh:NodeShape ;
            sh:name "Weergavenaam"@nl ;
            sh:name "Display Name"@en ;
        .
    `);

  expect(getCodeIdentifier(shapesGraph, ex("aShape"))).toEqual("Display Name");
});

test("getCodeIdentifier - falls back to the local name of the shape when nothing else is present", async () => {
  const shapesGraph = await parse(`
        ex:aShape a sh:NodeShape .
    `);

  expect(getCodeIdentifier(shapesGraph, ex("aShape"))).toEqual("aShape");
});
