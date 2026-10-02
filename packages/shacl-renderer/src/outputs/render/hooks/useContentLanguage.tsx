import { useContext } from "react";
import { contentLanguageContext } from "@/outputs/render/contexts/contentLanguageContext.tsx";

export const useContentLanguage = () => {
  const context = useContext(contentLanguageContext);
  if (!context) {
    throw new Error("useContentLanguage must be used within a ContentLanguageProvider");
  }
  return context;
};
