import type { Environment, RawEnvironment, SubmitResult } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";
import { type Preprocessor } from "@/preprocess/index.ts";
import EnvironmentContextProvider from "@/outputs/render/contexts/EnvironmentContextProvider.tsx";
import L10nProvider from "@/outputs/render/contexts/L10nProvider.tsx";
import InterfaceLanguageProvider from "@/outputs/render/contexts/InterfaceLanguageProvider.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { identityKey, pickLiveProps } from "@/outputs/render/environmentProps.ts";
import { lazy, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary, getErrorMessage } from "react-error-boundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/theme/index.css";
import "./style.css";

export type ShaclRendererProps = Partial<RawEnvironment> & {
  preprocessors?: readonly Preprocessor[];
};

export default function ShaclRenderer(inputProps: ShaclRendererProps) {
  const [queryClient] = useState(() => new QueryClient());
  const baseId = useId();

  // Identity props rebuild the Environment (a new key remounts the preprocessed subtree, and a new
  // instanceId gives it a fresh preprocess query); live props are merged in on every render - see
  // environmentProps.ts.
  const { preprocessors, ...environmentProps } = inputProps;
  const identity = identityKey({ ...environmentProps, preprocessors });
  const instanceId = `${baseId}:${identity}`;
  const liveProps = pickLiveProps(environmentProps);
  const liveSignature = JSON.stringify(liveProps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLiveProps = useMemo(() => liveProps, [liveSignature]);

  // Always calls the latest onSubmit, so an inline callback never goes stale, while the function
  // handed down keeps one identity for the renderer's lifetime.
  const onSubmitRef = useRef(inputProps.onSubmit);
  useLayoutEffect(() => {
    onSubmitRef.current = inputProps.onSubmit;
  });
  const onSubmit = useCallback((result: SubmitResult) => onSubmitRef.current?.(result), []);

  const interfaceLanguage = inputProps.interfaceLanguage ?? defaultEnvironment.interfaceLanguage;
  const interfaceLocales = inputProps.interfaceLocales ?? defaultEnvironment.interfaceLocales;

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
          <L10nProvider interfaceLocales={interfaceLocales}>
            <EnvironmentContextProvider
              key={identity}
              {...inputProps}
              onSubmit={onSubmit}
              liveProps={stableLiveProps}
              instanceId={instanceId}
            >
              <ShaclRendererInner />
            </EnvironmentContextProvider>
          </L10nProvider>
        </InterfaceLanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const modesComponents: Record<Environment["mode"], React.ComponentType> = {
  edit: lazy(() => import("@/outputs/render/modes/edit/index.tsx")),
  view: lazy(() => import("@/outputs/render/modes/view/index.tsx")),
  facet: lazy(() => import("@/outputs/render/modes/facet/index.tsx")),
};

function ShaclRendererInner() {
  const { mode } = useEnvironment();
  const ModeComponent = modesComponents[mode];
  return <ModeComponent />;
}
