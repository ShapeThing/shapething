import type { NamedNode, Quad } from "@rdfjs/types";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShaclRenderer } from "@shapething/shacl-everything";
import "@shapething/shacl-everything/style.css";
import DataModelProvider from "@/contexts/DataModelProvider.tsx";
import { useDataModel } from "@/hooks/useDataModel.ts";
import { factory } from "@/helpers/factory.ts";

// The ontology.ttl shapes graph targets owl:Ontology/sh:ShapesGraph - i.e. the data model's own
// subject - so it renders the data model's metadata (title, description, imports, ...), not its
// domain data. Resolved via Vite's new URL(..., import.meta.url) asset pattern (same as the
// storybook fixtures) so shacl-everything's own resolveRdfSources dereferences and parses it with
// a real base IRI, letting ontology.ttl's `<>` node shape resolve to an absolute IRI.
const ontologyShapesGraphUrl = new URL("./shapes/ontology.ttl#shape", import.meta.url);

// Without an explicit nodeShapes list, shacl-everything's resolveRdfSources falls back to every
// sh:NodeShape found anywhere in the shapes graph - including ontology.ttl's own #prefixShape,
// which exists solely to be reached via the "Prefixes" property's sh:node, never as a shape
// applying directly to the data model IRI. Left implicit, that flattened #prefixShape's own
// Prefix/Namespace properties straight onto the top-level form (on the wrong subject, no less)
// alongside #shape's real ones. Scoping nodeShapes to #shape only is what keeps #prefixShape
// nested inside the "Prefixes" field's own per-value editor instead.
const ontologyNodeShapes: NamedNode[] = [factory.namedNode(ontologyShapesGraphUrl.href)];

export type ShaclManagerProps = {
  dataModelIRI: NamedNode;
  loadGraph: (graph: NamedNode) => Promise<Quad[]>;
  // Forwarded to ShaclRenderer as-is - a fallback for shacl-everything's own internal fetches
  // (the shapesGraph URL, and any owl:imports it resolves itself on the graphs it's handed) when
  // a direct request fails, typically because the target doesn't send permissive CORS headers.
  // Unset means no fallback, same as ShaclRenderer's own default.
  corsProxyUrl?: string;
};

export function ShaclManager({ dataModelIRI, loadGraph, corsProxyUrl }: ShaclManagerProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <DataModelProvider
        dataModelIRI={dataModelIRI}
        loadGraph={loadGraph}
        fallback={<div>Loading…</div>}
      >
        <ShaclManagerInner corsProxyUrl={corsProxyUrl} />
      </DataModelProvider>
    </QueryClientProvider>
  );
}

function ShaclManagerInner({ corsProxyUrl }: Pick<ShaclManagerProps, "corsProxyUrl">) {
  const { dataModelIRI, store } = useDataModel();

  return (
    <ShaclRenderer
      shapesGraph={ontologyShapesGraphUrl}
      dataGraph={store}
      interfaceLocales={{ "nl-NL": null }}
      focusNode={dataModelIRI}
      nodeShapes={ontologyNodeShapes}
      enableWidgetSwitching={false}
      enableLogicalBranchSwitching={false}
      corsProxyUrl={corsProxyUrl}
    />
  );
}
