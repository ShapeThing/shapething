import { createContext } from "react";
import type { Environment } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";

export const environmentContext = createContext<Environment>(defaultEnvironment);
