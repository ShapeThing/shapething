import { useContext } from "react";
import { interfaceLanguageContext } from "@/outputs/render/contexts/interfaceLanguageContext.tsx";

export const useInterfaceLanguage = () => {
  const context = useContext(interfaceLanguageContext);
  if (!context) {
    throw new Error("useInterfaceLanguage must be used within an InterfaceLanguageProvider");
  }
  return context;
};
