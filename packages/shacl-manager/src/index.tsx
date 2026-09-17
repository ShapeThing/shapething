import type { NamedNode, Quad } from "@rdfjs/types";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@shapething/shacl-everything/style.css";
import DataModelProvider from "@/contexts/DataModelProvider.tsx";
import DatamodelMetadata from "@/components/DatamodelMetadata";
import Sidebar from "@/components/Sidebar";

export type ShaclManagerProps = {
  dataModelIRI: NamedNode;
  loadGraph: (graph: NamedNode) => Promise<Quad[]>;
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
  return (
    <>
      <DatamodelMetadata corsProxyUrl={corsProxyUrl} />
      <Sidebar />
    </>
  );
}
