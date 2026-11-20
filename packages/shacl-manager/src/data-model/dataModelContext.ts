import { createContext, use } from "react";
import type { DataModel } from "./loadDataModel.ts";

export const DataModelContext = createContext<DataModel | null>(null);

export function useDataModel(): DataModel {
  const dataModel = use(DataModelContext);
  if (!dataModel) throw new Error("useDataModel() needs a <DataModelContext> provider");
  return dataModel;
}

// Replaces the data model with an edited one.
export const CommitContext = createContext<((next: DataModel) => void) | null>(null);

export function useCommit(): (next: DataModel) => void {
  const commit = use(CommitContext);
  if (!commit) throw new Error("useCommit() needs a <CommitContext> provider");
  return commit;
}
