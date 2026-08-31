import { useEffect, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import turtle from "react-syntax-highlighter/dist/esm/languages/prism/turtle";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { write } from "@jeswr/pretty-turtle";
// generate is a pure Node-oriented helper - it's never exercised through ShaclRenderer's own
// preprocessing pipeline (which already carries these polyfills), so this story loads them itself
// before calling the same rdf-parse-based parseRdf() the unit tests use. See shacl-to-type.stories.tsx.
import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { prefixes } from "@/helpers/namespaces.ts";
import { generate } from "@/outputs/generate.ts";
import type { BCP47 } from "@/types/BCP47.ts";

SyntaxHighlighter.registerLanguage("turtle", turtle);

type GenerateDemoProps = {
  shapesGraph: string;
  focusNode: string;
  nodeShapes: string[];
  contentLanguage?: BCP47;
  seed?: number;
};

// Kept as plain strings, never a parsed RdfStore - see this package's CLAUDE.md on RdfStore's own
// internal reference cycle crashing Storybook's Controls-panel diffing.
function GenerateDemo({ shapesGraph, focusNode, nodeShapes, contentLanguage, seed }: GenerateDemoProps) {
  const [output, setOutput] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    parseRdf(shapesGraph, "text/turtle")
      .then((shapes) =>
        generate({
          shapesGraph: shapes,
          focusNode: factory.namedNode(focusNode),
          nodeShapes: nodeShapes.map((iri) => factory.namedNode(iri)),
          contentLanguage,
          seed,
        }),
      )
      .then((dataGraph) => write(dataGraph.getQuads(), { ordered: true, prefixes }))
      .then((turtleText) => {
        if (!cancelled) setOutput(turtleText);
      });
    return () => {
      cancelled = true;
    };
  }, [shapesGraph, focusNode, nodeShapes, contentLanguage, seed]);

  return (
    <SyntaxHighlighter
      language="turtle"
      style={oneLight}
      wrapLongLines
      codeTagProps={{ style: { overflowWrap: "anywhere" } }}
    >
      {output ?? "Generating…"}
    </SyntaxHighlighter>
  );
}

type Story = StoryObj<GenerateDemoProps>;

export default {
  title: "Tools/Generate",
  component: GenerateDemo,
};

export const withFakerAnnotations: Story = {
  name: "faker:generator annotations pick exactly which faker.js call fakes each property",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix faker: <https://fakerjs.dev/> .

      ex:Person a sh:NodeShape ;
          sh:property [
              sh:path ex:givenName ; sh:datatype xsd:string ;
              faker:generator faker:person.firstName ;
              sh:minCount 1 ; sh:maxCount 1 ;
          ] ;
          sh:property [
              sh:path ex:familyName ; sh:datatype xsd:string ;
              faker:generator faker:person.lastName ;
              sh:minCount 1 ; sh:maxCount 1 ;
          ] ;
          sh:property [
              sh:path ex:jobTitle ; sh:datatype xsd:string ;
              faker:generator faker:person.jobTitle ;
              sh:minCount 1 ; sh:maxCount 1 ;
          ] ;
          sh:property [
              sh:path ex:address ; sh:datatype xsd:string ;
              faker:generator ( faker:location.streetAddress ", " faker:location.city ) ;
              sh:minCount 1 ; sh:maxCount 1 ;
          ] .
    `,
    focusNode: "http://example.org/person1",
    nodeShapes: ["http://example.org/Person"],
    seed: 1,
  },
};

export const withoutFakerAnnotations: Story = {
  name: "no faker: vocabulary at all - sh:datatype plus a keyword guess from the property's own name is enough",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Person a sh:NodeShape ;
          sh:property [ sh:path ex:givenName ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path ex:familyName ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path ex:email ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path ex:birthDate ; sh:datatype xsd:date ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path ex:bio ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [
              sh:path ex:score ; sh:datatype xsd:integer ;
              sh:minInclusive 0 ; sh:maxInclusive 100 ;
              sh:minCount 1 ; sh:maxCount 1 ;
          ] ;
          sh:property [ sh:path ex:active ; sh:datatype xsd:boolean ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [
              sh:path ex:status ; sh:in ( "Active" "Inactive" "Pending" ) ;
              sh:minCount 1 ; sh:maxCount 1 ;
          ] ;
          sh:property [ sh:path ex:address ; sh:node ex:AddressShape ; sh:minCount 1 ; sh:maxCount 1 ] .

      ex:AddressShape a sh:NodeShape ;
          sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path ex:city ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path ex:postalCode ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] ;
          sh:property [ sh:path ex:country ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ] .
    `,
    focusNode: "http://example.org/person1",
    nodeShapes: ["http://example.org/Person"],
    seed: 1,
  },
};
