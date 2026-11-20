import { createContext, use } from "react";
import type { DataModel } from "./loadDataModel.ts";

export const DataModelContext = createContext<DataModel | null>(null);

export function useDataModel(): DataModel {
  const dataModel = use(DataModelContext);
  if (!dataModel) throw new Error("useDataModel() needs a <DataModelContext> provider");
  return dataModel;
}

// Every prefix declared by the data model and its imports, see loadDataModel.
export function usePrefixes(): Record<string, string> {
  return useDataModel().prefixes;
}
