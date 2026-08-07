import { useState, type ReactNode } from "react";
import { interfaceLanguageContext } from "@/outputs/render/contexts/interfaceLanguageContext.tsx";
import type { BCP47 } from "@/types/BCP47.ts";

// Deliberately independent of Environment/useEnvironment() - it seeds straight from the raw
// interfaceLanguage prop rather than the preprocessed Environment, so it can sit above
// EnvironmentContextProvider and let L10nProvider localize even the "resolving environment..."
// loading state itself (see render.tsx's provider order).
export default function InterfaceLanguageProvider({
  interfaceLanguage,
  children,
}: {
  interfaceLanguage: BCP47;
  children: ReactNode;
}) {
  const [activeInterfaceLanguage, setActiveInterfaceLanguage] = useState<BCP47>(interfaceLanguage);

  return (
    <interfaceLanguageContext.Provider
      value={{ activeInterfaceLanguage, setActiveInterfaceLanguage }}
    >
      {children}
    </interfaceLanguageContext.Provider>
  );
}
