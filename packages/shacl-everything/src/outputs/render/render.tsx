import type { Environment, RawEnvironment } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";
import { type Preprocessor } from "@/preprocess/index.ts";
import EnvironmentContextProvider from "@/outputs/render/contexts/EnvironmentContextProvider.tsx";
import L10nProvider from "@/outputs/render/contexts/L10nProvider.tsx";
import InterfaceLanguageProvider from "@/outputs/render/contexts/InterfaceLanguageProvider.tsx";
import ContentLanguageSwitcher from "@/outputs/render/components/ContentLanguageSwitcher/index.tsx";
import InterfaceLanguageSwitcher from "@/outputs/render/components/InterfaceLanguageSwitcher/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { lazy, useId, useState } from "react";
import { ErrorBoundary, getErrorMessage } from "react-error-boundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/theme/index.css";
import "./style.css";

export type ShaclRendererProps = Partial<RawEnvironment> & {
  preprocessors?: readonly Preprocessor[];
};

export default function ShaclRenderer(inputProps: ShaclRendererProps) {
  const [queryClient] = useState(() => new QueryClient());
  const instanceId = useId();
  const interfaceLanguage = inputProps.interfaceLanguage ?? defaultEnvironment.interfaceLanguage;

  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div role="alert">
          <pre>{getErrorMessage(error)}</pre>
        </div>
      )}
    >
      <QueryClientProvider client={queryClient}>
        <InterfaceLanguageProvider interfaceLanguage={interfaceLanguage}>
          <L10nProvider>
            <EnvironmentContextProvider {...inputProps} instanceId={instanceId}>
              <ShaclRendererInner />
            </EnvironmentContextProvider>
          </L10nProvider>
        </InterfaceLanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const modesNodeUIComponents: Record<Environment["mode"], React.ComponentType> = {
  edit: lazy(() => import("@/outputs/render/modes/edit/NodeUIComponent.tsx")),
  view: lazy(() => import("@/outputs/render/modes/view/NodeUIComponent.tsx")),
  facet: lazy(() => import("@/outputs/render/modes/facet/NodeUIComponent.tsx")),
};

function ShaclRendererInner() {
  const { mode } = useEnvironment();
  const NodeUIComponent = modesNodeUIComponents[mode];
  return (
    <>
      <header className="st-header">
        <InterfaceLanguageSwitcher />
        <ContentLanguageSwitcher />
      </header>
      <NodeUIComponent />
    </>
  );
}
