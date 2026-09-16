import { createContext } from "react";
import type { DataModel } from "@/dataModel.ts";

export const dataModelContext = createContext<DataModel | undefined>(undefined);
