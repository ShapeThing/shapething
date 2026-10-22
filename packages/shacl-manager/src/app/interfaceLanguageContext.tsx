import { createContext } from "react";

export type InterfaceLanguageContextValue = {
  activeInterfaceLanguage: string;
  setActiveInterfaceLanguage: (language: string) => void;
};

export const interfaceLanguageContext = createContext<InterfaceLanguageContextValue | undefined>(
  undefined,
);
