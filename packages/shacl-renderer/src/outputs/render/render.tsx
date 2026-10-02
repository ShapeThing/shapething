import type { Environment, RawEnvironment, SubmitResult } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";
import { type Preprocessor } from "@/preprocess/index.ts";
import EnvironmentContextProvider from "@/outputs/render/contexts/EnvironmentContextProvider.tsx";
import L10nProvider from "@/outputs/render/contexts/L10nProvider.tsx";
import InterfaceLanguageProvider from "@/outputs/render/contexts/InterfaceLanguageProvider.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { identityKey, pickLiveProps } from "@/outputs/render/environmentProps.ts";
import { lazy, useCallback, useId, useLayoutEffect, useMemo, useRef } from "react";
import { ErrorBoundary, getErrorMessage } from "react-error-boundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/theme/index.css";
import "./style.css";

export type ShaclRendererProps = Partial<RawEnvironment> & {
  preprocessors?: readonly Preprocessor[];
  // Extra class(es) for the active mode's root element (.st-edit-mode, .st-view-mode, ...), e.g.
  // to scope an embedder's own styles. Not part of the Environment, so changing it never rebuilds
  // the form.
  className?: string;
};

export type ModeProps = {
  className?: string;
};

export default function ShaclRenderer(inputProps: ShaclRendererProps) {
  const baseId = useId();

  // Identity props rebuild the Environment (a new key remounts the preprocessed subtree, and a new
  // instanceId gives it a fresh preprocess query); live props are merged in on every render - see
  // environmentProps.ts.
  const { preprocessors, className, ...environmentProps } = inputProps;
  const identity = identityKey({ ...environmentProps, preprocessors });
  const instanceId = `${baseId}:${identity}`;

  // A fresh cache per identity, too: most query keys (e.g. useWidget's) are scoped by property
  // shape IRI rather than by Environment, so a new shapesGraph reusing the same IRIs would
  // otherwise get the previous session's widget picks back.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryClient = useMemo(() => new QueryClient(), [identity]);
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
              {...environmentProps}
              preprocessors={preprocessors}
              onSubmit={onSubmit}
              liveProps={stableLiveProps}
              instanceId={instanceId}
            >
              <ShaclRendererInner className={className} />
            </EnvironmentContextProvider>
          </L10nProvider>
        </InterfaceLanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const modesComponents: Record<Environment["mode"], React.ComponentType<ModeProps>> = {
  edit: lazy(() => import("@/outputs/render/modes/edit/index.tsx")),
  view: lazy(() => import("@/outputs/render/modes/view/index.tsx")),
  facet: lazy(() => import("@/outputs/render/modes/facet/index.tsx")),
  report: lazy(() => import("@/outputs/render/modes/report/index.tsx")),
};

function ShaclRendererInner({ className }: ModeProps) {
  const { mode } = useEnvironment();
  const ModeComponent = modesComponents[mode];
  return <ModeComponent className={className} />;
}
