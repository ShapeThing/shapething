import type { NamedNode, Quad } from "@rdfjs/types";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Localized } from "@fluent/react";
import "@shapething/shacl-everything/style.css";
import DataModelProvider from "@/contexts/DataModelProvider.tsx";
import { createShaclManagerRouter } from "@/router.tsx";
import InterfaceLanguageProvider from "@/contexts/InterfaceLanguageProvider.tsx";
import L10nProvider from "@/contexts/L10nProvider.tsx";
import { DEFAULT_LOCALE, type LocaleLoaderOverrides } from "@/l10n/locales.ts";

export type ShaclManagerProps = {
  dataModelIRI: NamedNode;
  loadGraph: (graph: NamedNode) => Promise<Quad[]>;
  corsProxyUrl?: string;
  interfaceLanguage?: string;
  interfaceLocales?: LocaleLoaderOverrides;
};

export function ShaclManager({
  dataModelIRI,
  loadGraph,
  corsProxyUrl,
  interfaceLanguage = DEFAULT_LOCALE,
  interfaceLocales,
}: ShaclManagerProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [router] = useState(() => createShaclManagerRouter({ corsProxyUrl }, dataModelIRI.value));

  return (
    <QueryClientProvider client={queryClient}>
      <InterfaceLanguageProvider interfaceLanguage={interfaceLanguage}>
        <L10nProvider interfaceLocales={interfaceLocales}>
          <DataModelProvider
            dataModelIRI={dataModelIRI}
            loadGraph={loadGraph}
            fallback={
              <Localized id="shacl-manager-loading">
                <div>Loading…</div>
              </Localized>
            }
          >
            <RouterProvider router={router} />
          </DataModelProvider>
        </L10nProvider>
      </InterfaceLanguageProvider>
    </QueryClientProvider>
  );
}
