import type { ReactNode } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import sparql from "react-syntax-highlighter/dist/esm/languages/prism/sparql";
import { declaredPrefixes, prefixDeclarationLines } from "@/helpers/sparqlPrefixes.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

SyntaxHighlighter.registerLanguage("sparql", sparql);

// Each highlighted part renders only its <code>, inside the one <pre> below.
const Bare = ({ children }: { children?: ReactNode }) => children;

/**
 * A SPARQL query (an sh:select, sh:ask or sh:construct, or any other literal holding one), shown
 * as a syntax-highlighted code block. Prism's token classes are coloured by style.css from the
 * --st-code-* theme tokens rather than by an inline theme, so an embedder restyles it like the
 * rest of the renderer. Loaded lazily (see widgets/registry.ts): only a form that shows a query
 * pays for the highlighter.
 *
 * The query is shown as it runs: with a PREFIX line in front for every prefix the node holding it
 * declares through sh:prefixes/sh:declare (helpers/sparqlPrefixes.ts) and the query doesn't
 * declare itself. Those lines are their own <code> (st-sparql-viewer__declared), as they are not
 * part of the query text in the data.
 */
export default function SparqlViewer({ shape, term }: WidgetProps) {
  const declarations = useReactiveRead(
    shape.dataGraph,
    `sparql-viewer-prefixes@${shape.focusNode.termType}:${shape.focusNode.value}`,
    () => declaredPrefixes(shape.focusNode, shape.dataGraph),
  );
  const query = term.value.trim();
  const prefixLines = prefixDeclarationLines(query, declarations);

  return (
    <pre className="st-sparql-viewer">
      {prefixLines.length > 0 && (
        <SyntaxHighlighter
          language="sparql"
          useInlineStyles={false}
          PreTag={Bare}
          codeTagProps={{ className: "st-sparql-viewer__declared" }}
        >
          {prefixLines.join("\n")}
        </SyntaxHighlighter>
      )}
      <SyntaxHighlighter
        language="sparql"
        useInlineStyles={false}
        PreTag={Bare}
        codeTagProps={{ className: "st-sparql-viewer__query" }}
      >
        {query}
      </SyntaxHighlighter>
    </pre>
  );
}
