import { useEffect, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import turtle from "react-syntax-highlighter/dist/esm/languages/prism/turtle";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { write } from "@jeswr/pretty-turtle";

SyntaxHighlighter.registerLanguage("turtle", turtle);
// jsToRdf is a pure Node-oriented helper - it's never exercised through ShaclRenderer's own
// preprocessing pipeline (which already carries these polyfills), so this story loads them itself
// before calling the same rdf-parse-based parseRdf() the unit tests use. See shacl-to-type.stories.tsx.
import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { prefixes } from "@/helpers/namespaces.ts";
import { jsToRdf } from "@/outputs/js-to-rdf.ts";
import type { BCP47 } from "@/types/BCP47.ts";

type JsToRdfDemoProps = {
  shapesGraph: string;
  focusNode: string;
  nodeShapes: string[];
  data: Record<string, unknown>;
  contentLanguage?: BCP47;
};

// Kept as plain strings/a plain JS object, never a parsed RdfStore - see this package's CLAUDE.md
// on RdfStore's own internal reference cycle crashing Storybook's Controls-panel diffing, and
// .storybook/withSubmitPreview.tsx for the same write()-to-Turtle-string approach used here.
function JsToRdfDemo({
  shapesGraph,
  focusNode,
  nodeShapes,
  data,
  contentLanguage,
}: JsToRdfDemoProps) {
  const [output, setOutput] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    parseRdf(shapesGraph, "text/turtle")
      .then((shapes) =>
        jsToRdf({
          shapesGraph: shapes,
          focusNode: factory.namedNode(focusNode),
          nodeShapes: nodeShapes.map((iri) => factory.namedNode(iri)),
          data,
          contentLanguage,
        }),
      )
      .then((dataGraph) => write(dataGraph.getQuads(), { ordered: true, prefixes }))
      .then((turtleText) => {
        if (!cancelled) setOutput(turtleText);
      });
    return () => {
      cancelled = true;
    };
  }, [shapesGraph, focusNode, nodeShapes, data, contentLanguage]);

  return (
    <SyntaxHighlighter
      language="turtle"
      style={oneLight}
      wrapLongLines
      codeTagProps={{ style: { overflowWrap: "anywhere" } }}
    >
      {output ?? "Converting…"}
    </SyntaxHighlighter>
  );
}

type Story = StoryObj<JsToRdfDemoProps>;

export default {
  title: "Tools/JS to RDF",
  component: JsToRdfDemo,
};

const recipeShapes = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix ex: <http://example.org/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

  ex:Recipe a sh:NodeShape ;
      sh:property [ sh:path ex:title ; sh:datatype rdf:langString ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:servings ; sh:datatype xsd:integer ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:publishedOn ; sh:datatype xsd:date ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:ingredient ; sh:datatype xsd:string ] ;
      sh:property [ sh:path ex:address ; sh:node ex:AddressShape ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:steps ; sh:memberShape [ sh:node ex:StepShape ] ] .

  ex:AddressShape a sh:NodeShape ;
      sh:property [ sh:path ex:street ; sh:datatype xsd:string ; sh:maxCount 1 ] ;
      sh:property [ sh:path ex:city ; sh:datatype xsd:string ; sh:maxCount 1 ] .

  ex:StepShape a sh:NodeShape ;
      sh:property [ sh:path ex:instruction ; sh:datatype xsd:string ; sh:maxCount 1 ] .
`;

export const recipeOverview: Story = {
  name: "Scalars, a date, an array, a nested object and a memberShape list, plus rdf:langString",
  args: {
    shapesGraph: recipeShapes,
    focusNode: "http://example.org/recipe1",
    nodeShapes: ["http://example.org/Recipe"],
    contentLanguage: "en-GB",
    data: {
      title: "Chicken Soup",
      servings: 4,
      publishedOn: new Date(Date.UTC(2024, 2, 15)),
      ingredient: ["Chicken", "Salt", "Pepper"],
      address: { street: "Main St", city: "Springfield" },
      steps: [{ instruction: "Boil water" }, { instruction: "Add the chicken" }],
    },
  },
};

export const logicalOrBranch: Story = {
  name: "sh:or - the branch whose keys best match the given data is the one written",
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
    focusNode: "http://example.org/recipe1",
    nodeShapes: ["http://example.org/Recipe"],
    data: { title: "Beef Stew", meatType: "Beef" },
  },
};
