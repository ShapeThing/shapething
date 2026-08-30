import { useEffect, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { format } from "prettier/standalone";
import typescriptPlugin from "prettier/plugins/typescript";
import estreePlugin from "prettier/plugins/estree";

SyntaxHighlighter.registerLanguage("typescript", typescript);
// shaclToType is a pure Node-oriented codegen helper - it's never exercised through
// ShaclRenderer's own preprocessing pipeline (which already carries these polyfills), so this
// story loads them itself before calling the same rdf-parse-based parseRdf() the unit tests use.
import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { shaclToType } from "@/outputs/shacl-to-type.ts";

type ShaclToTypeDemoProps = {
  shapesGraph: string;
};

// The input shapes graph is visible via Storybook's own "Graph Inspector" addon panel, which
// already picks up the shapesGraph arg globally (see .storybook/addons/graph-inspector) - no need
// to render it again here. shaclToType()'s own output is deliberately compact - its unit tests
// assert on the exact string - so it's run through Prettier here purely for display; the library
// itself stays untouched.
function ShaclToTypeDemo({ shapesGraph }: ShaclToTypeDemoProps) {
  const [output, setOutput] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    parseRdf(shapesGraph, "text/turtle")
      .then((store) => {
        const types = shaclToType({ shapesGraph: store });
        return format([...types.values()].join("\n"), {
          parser: "typescript",
          plugins: [typescriptPlugin, estreePlugin],
        });
      })
      .then((formatted) => {
        if (!cancelled) setOutput(formatted);
      });
    return () => {
      cancelled = true;
    };
  }, [shapesGraph]);

  return (
    <SyntaxHighlighter
      language="typescript"
      style={oneLight}
      wrapLongLines
      // oneLight's own "code[...]" style bakes in whiteSpace: "pre", and react-syntax-highlighter
      // only computes that default codeTagProps when the caller doesn't pass one - it merges
      // wrapLongLines's "pre-wrap" underneath whatever codeTagProps.style already holds, so the
      // theme's "pre" silently wins unless a (whiteSpace-free) codeTagProps is supplied here to
      // opt out of that default.
      codeTagProps={{ style: { overflowWrap: "anywhere" } }}
    >
      {output ?? "Generating…"}
    </SyntaxHighlighter>
  );
}

type Story = StoryObj<ShaclToTypeDemoProps>;

export default {
  title: "Tools/SHACL to TypeScript",
  component: ShaclToTypeDemo,
};

export const scalarProperties: Story = {
  name: "Required, optional and array properties",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Recipe a sh:NodeShape ;
          sh:property [
              sh:path ex:title ;
              sh:datatype xsd:string ;
              sh:minCount 1 ;
              sh:maxCount 1 ;
          ] ;
          sh:property [
              sh:path ex:subtitle ;
              sh:datatype xsd:string ;
              sh:minCount 0 ;
              sh:maxCount 1 ;
          ] ;
          sh:property [
              sh:path ex:ingredient ;
              sh:datatype xsd:string ;
              sh:minCount 1 ;
          ] .
    `,
  },
};

export const datatypeMapping: Story = {
  name: "sh:datatype mapping, including a SHACL list of alternatives",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

      ex:Recipe a sh:NodeShape ;
          sh:property [
              sh:path ex:servings ;
              sh:datatype xsd:integer ;
              sh:minCount 1 ;
              sh:maxCount 1 ;
          ] ;
          sh:property [
              sh:path ex:vegan ;
              sh:datatype xsd:boolean ;
              sh:minCount 1 ;
              sh:maxCount 1 ;
          ] ;
          sh:property [
              sh:path ex:title ;
              sh:datatype ( xsd:string rdf:langString ) ;
              sh:minCount 1 ;
              sh:maxCount 1 ;
          ] .
    `,
  },
};

export const naming: Story = {
  name: "Type naming: sh:codeIdentifier, sh:name, then local name",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .

      ex:Recipe a sh:NodeShape ;
          sh:codeIdentifier "ChickenSoupRecipe" .

      ex:Ingredient a sh:NodeShape ;
          sh:name "IngredientType" .

      ex:Author a sh:NodeShape .
    `,
  },
};

export const orUnion: Story = {
  name: "sh:or as an inclusive union, intersected with plain properties",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Recipe a sh:NodeShape ;
          sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:or (
              [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
              [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
          ) .
    `,
  },
};

export const xoneUnion: Story = {
  name: "sh:xone as a mutually-exclusive union",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Recipe a sh:NodeShape ;
          sh:xone (
              [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
              [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
              [ sh:property [ sh:path ex:halalCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
          ) .
    `,
  },
};

export const nestedOrViaNode: Story = {
  name: "A branch's own properties intersected with a further nested sh:or",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Recipe a sh:NodeShape ;
          sh:or (
              [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
              [
                  sh:property [ sh:path ex:servings ; sh:datatype xsd:integer ; sh:minCount 1 ; sh:maxCount 1 ] ;
                  sh:or (
                      [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
                      [ sh:property [ sh:path ex:halalCertification ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ]
                  ) ;
              ]
          ) .
    `,
  },
};

export const memberShape: Story = {
  name: "sh:memberShape: a scalar rdf:List and an object rdf:List (via sh:node), each as an array type",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Recipe a sh:NodeShape ;
          sh:property [
              sh:path ex:scores ;
              sh:memberShape [
                  sh:datatype xsd:integer ;
                  sh:minInclusive 0 ;
                  sh:maxInclusive 100 ;
              ] ;
          ] ;
          sh:property [
              sh:path ex:steps ;
              sh:minListLength 1 ;
              sh:memberShape [ sh:node ex:StepShape ] ;
          ] .

      ex:StepShape a sh:NodeShape ;
          sh:property [ sh:path ex:instruction ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
          sh:property [ sh:path ex:duration ; sh:datatype xsd:integer ; sh:maxCount 1 ] .
    `,
  },
};
