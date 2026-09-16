import type { NamedNode } from "@rdfjs/types";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { dataModelContext } from "@/contexts/dataModelContext.ts";
import { loadDataModel, type LoadGraph } from "@/dataModel.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";

export type DataModelProviderProps = {
  dataModelIRI: NamedNode;
  loadGraph: LoadGraph;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function DataModelProvider({
  dataModelIRI,
  loadGraph,
  children,
  fallback,
}: DataModelProviderProps) {
  return (
    <Suspense fallback={fallback}>
      <ResolvedDataModelProvider dataModelIRI={dataModelIRI} loadGraph={loadGraph}>
        {children}
      </ResolvedDataModelProvider>
    </Suspense>
  );
}

function ResolvedDataModelProvider({
  dataModelIRI,
  loadGraph,
  children,
}: Omit<DataModelProviderProps, "fallback">) {
  const { data: dataModel } = useSuspenseQuery({
    queryKey: ["shacl-manager-data-model", dataModelIRI.value],
    ...noRefetch,
    queryFn: () => loadDataModel(dataModelIRI, loadGraph),
  });

  return <dataModelContext.Provider value={dataModel}>{children}</dataModelContext.Provider>;
}
