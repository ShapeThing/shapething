import { useEffect, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";

SyntaxHighlighter.registerLanguage("json", json);
// rdfToJs is a pure Node-oriented helper - it's never exercised through ShaclRenderer's own
// preprocessing pipeline (which already carries these polyfills), so this story loads them itself
// before calling the same rdf-parse-based parseRdf() the unit tests use. See shacl-to-type.stories.tsx.
import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { rdfToJs } from "@/outputs/rdf-to-js.ts";
import type { LanguageRange } from "@/types/BCP47.ts";

type RdfToJsDemoProps = {
  shapesGraph: string;
  dataGraph: string;
  focusNode: string;
  nodeShapes: string[];
  languages?: LanguageRange[];
};

// Kept as plain strings/arrays, never a parsed RdfStore - see this package's CLAUDE.md on
// RdfStore's own internal reference cycle crashing Storybook's Controls-panel diffing if one is
// ever passed as a literal story arg.
function RdfToJsDemo({
  shapesGraph,
  dataGraph,
  focusNode,
  nodeShapes,
  languages,
}: RdfToJsDemoProps) {
  const [output, setOutput] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    Promise.all([parseRdf(shapesGraph, "text/turtle"), parseRdf(dataGraph, "text/turtle")])
      .then(([shapes, data]) =>
        rdfToJs({
          shapesGraph: shapes,
          dataGraph: data,
          focusNode: factory.namedNode(focusNode),
          nodeShapes: nodeShapes.map((iri) => factory.namedNode(iri)),
          languages,
        }),
      )
      .then((result) => {
        if (!cancelled) setOutput(JSON.stringify(result, null, 2));
      });
    return () => {
      cancelled = true;
    };
  }, [shapesGraph, dataGraph, focusNode, nodeShapes, languages]);

  return (
    <SyntaxHighlighter
      language="json"
      style={oneLight}
      wrapLongLines
      codeTagProps={{ style: { overflowWrap: "anywhere" } }}
    >
      {output ?? "Converting…"}
    </SyntaxHighlighter>
  );
}

type Story = StoryObj<RdfToJsDemoProps>;

export default {
  title: "Tools/RDF to JS",
  component: RdfToJsDemo,
};

const recipeShapes = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix ex: <http://example.org/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

  ex:Recipe a sh:NodeShape ;
      sh:property [ sh:path ex:title ; sh:datatype rdf:langString ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:servings ; sh:datatype xsd:integer ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:vegan ; sh:datatype xsd:boolean ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:publishedOn ; sh:datatype xsd:date ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:ingredient ; sh:datatype xsd:string ] ;
      sh:property [ sh:path ex:author ; sh:class ex:Person ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:address ; sh:node ex:AddressShape ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:steps ; sh:memberShape [ sh:node ex:StepShape ] ] .

  ex:AddressShape a sh:NodeShape ;
      sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:city ; sh:datatype xsd:string ; sh:maxCount 1 ] .

  ex:StepShape a sh:NodeShape ;
      sh:property [ sh:path ex:instruction ; sh:datatype xsd:string ; sh:maxCount 1 ] .
`;

export const recipeOverview: Story = {
  name: "Scalars, a date, an array, a resource reference, a nested object and a memberShape list",
  args: {
    shapesGraph: recipeShapes,
    dataGraph: `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:recipe1
          ex:title "Chicken Soup"@en, "Kippensoep"@nl ;
          ex:servings "4"^^xsd:integer ;
          ex:vegan "false"^^xsd:boolean ;
          ex:publishedOn "2024-03-15"^^xsd:date ;
          ex:ingredient "Chicken", "Salt", "Pepper" ;
          ex:author ex:person1 ;
          ex:address [ ex:street "Main St" ; ex:city "Springfield" ] ;
          ex:steps ( [ ex:instruction "Boil water" ] [ ex:instruction "Add the chicken" ] ) .
    `,
    focusNode: "http://example.org/recipe1",
    nodeShapes: ["http://example.org/Recipe"],
    languages: ["en"],
  },
};

export const logicalOrBranch: Story = {
  name: "sh:or - the branch the data already conforms to is merged into the result",
  args: {
    shapesGraph: `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

      ex:Recipe a sh:NodeShape ;
          sh:property [ sh:path ex:title ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
          sh:or (
              [ sh:property [ sh:path ex:meatType ; sh:datatype xsd:string ; sh:maxCount 1 ] ]
              [ sh:property [ sh:path ex:veganCertification ; sh:datatype xsd:string ; sh:maxCount 1 ] ]
          ) .
    `,
    dataGraph: `
      @prefix ex: <http://example.org/> .
      ex:recipe1 ex:title "Beef Stew" ; ex:meatType "Beef" .
    `,
    focusNode: "http://example.org/recipe1",
    nodeShapes: ["http://example.org/Recipe"],
  },
};
