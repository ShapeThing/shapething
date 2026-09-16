import { useContext } from "react";
import { dataModelContext } from "@/contexts/dataModelContext.ts";

export function useDataModel() {
  const context = useContext(dataModelContext);
  if (!context) {
    throw new Error("useDataModel must be used within a DataModelProvider");
  }
  return context;
}
