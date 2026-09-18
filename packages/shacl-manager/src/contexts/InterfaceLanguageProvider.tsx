import { useState, type ReactNode } from "react";
import { interfaceLanguageContext } from "@/contexts/interfaceLanguageContext.tsx";

export default function InterfaceLanguageProvider({
  interfaceLanguage,
  children,
}: {
  interfaceLanguage: string;
  children: ReactNode;
}) {
  const [activeInterfaceLanguage, setActiveInterfaceLanguage] = useState(interfaceLanguage);

  return (
    <interfaceLanguageContext.Provider
      value={{ activeInterfaceLanguage, setActiveInterfaceLanguage }}
    >
      {children}
    </interfaceLanguageContext.Provider>
  );
}
