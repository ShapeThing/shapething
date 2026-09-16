import type { NamedNode, Quad } from "@rdfjs/types";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DataModelProvider from "@/contexts/DataModelProvider.tsx";
import { useDataModel } from "@/hooks/useDataModel.ts";

export type ShaclManagerProps = {
  dataModelIRI: NamedNode;
  loadGraph: (graph: NamedNode) => Promise<Quad[]>;
};

export function ShaclManager({ dataModelIRI, loadGraph }: ShaclManagerProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <DataModelProvider
        dataModelIRI={dataModelIRI}
        loadGraph={loadGraph}
        fallback={<div>Loading…</div>}
      >
        <ShaclManagerInner />
      </DataModelProvider>
    </QueryClientProvider>
  );
}

function ShaclManagerInner() {
  const { store, importedGraphIRIs } = useDataModel();

  console.log(store);

  return <div>Hello, ShaclManager!</div>;
}
