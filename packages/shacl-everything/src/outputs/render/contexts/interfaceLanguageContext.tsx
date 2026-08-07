import { createContext } from "react";
import type { BCP47 } from "@/types/BCP47.ts";

export type InterfaceLanguageContextValue = {
  activeInterfaceLanguage: BCP47;
  setActiveInterfaceLanguage: (language: BCP47) => void;
};

export const interfaceLanguageContext = createContext<InterfaceLanguageContextValue | undefined>(
  undefined,
);
