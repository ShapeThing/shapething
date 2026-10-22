import { createContext } from "react";
import type { DataModel } from "@/data-model/loadDataModel.ts";

export const dataModelContext = createContext<DataModel | undefined>(undefined);
