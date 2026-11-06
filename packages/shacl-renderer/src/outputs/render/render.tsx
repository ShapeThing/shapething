import type { Environment, RawEnvironment, SubmitResult } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";
import { type Preprocessor } from "@/preprocess/index.ts";
import EnvironmentContextProvider from "@/outputs/render/contexts/EnvironmentContextProvider.tsx";
import L10nProvider from "@/outputs/render/contexts/L10nProvider.tsx";
import {
  LoadingFallback,
  loadingIndicatorContext,
} from "@/outputs/render/contexts/loadingIndicatorContext.tsx";
import { SettleGate } from "@/outputs/render/contexts/settleGate.tsx";
import { type ResolveLink, resolveLinkContext } from "@/outputs/render/components/Link/index.tsx";
import InterfaceLanguageProvider from "@/outputs/render/contexts/InterfaceLanguageProvider.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { identityKey, pickLiveProps } from "@/outputs/render/environmentProps.ts";
import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
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
  // What the renderer shows while something loads (the Environment, interface strings, a lazily
  // loaded widget, ...). Omitted, a spinner; `null` shows nothing (e.g. when the embedder has its
  // own loading state, or the data is local and loads too fast for a spinner to be more than a
  // flash); any other node replaces the spinner everywhere. Not part of the Environment either, so
  // changing it never rebuilds the form. Spinners inside a widget's own UI (e.g. an autocomplete
  // searching) are the widget's business and stay.
  loadingIndicator?: React.ReactNode;
  // At most how many ms the first paint of the form is held back while it loads (widgets
  // resolving, lazy widgets, label lookups, ...), so it appears at once instead of labels first
  // and values popping in afterwards - see contexts/settleGate.tsx. Defaults to 3000; 0 shows
  // every part as soon as it is ready. Only the initial load is held, and it is not part of the
  // Environment either.
  settleTimeout?: number;
  // What shows while the first paint is held back (settleTimeout), in place of the still-invisible
  // form. Omitted, `loadingIndicator`, or the built-in spinner when that is `null` or omitted: the
  // form is hidden, so without an indicator there would be nothing to see at all.
  settleIndicator?: React.ReactNode;
  // Rewrites the links the viewers render (shui:LabelViewer, shui:IRIViewer, shui:HyperlinkViewer,
  // shui:ImageViewer, st:href links, and every custom viewer built on the exported Link): given the
  // href a link would have, the attributes to put over it - see components/Link's ResolveLink. E.g.
  // an IRI pointed at a route of the embedder's own, kept in the page, or marked as the current
  // one. Not part of the Environment either: a new function only re-renders the links.
  resolveLink?: ResolveLink;
};

export type ModeProps = {
  className?: string;
};

export default function ShaclRenderer(inputProps: ShaclRendererProps) {
  const baseId = useId();

  // Identity props rebuild the Environment (a new key remounts the preprocessed subtree, and a new
  // instanceId gives it a fresh preprocess query); live props are merged in on every render - see
  // environmentProps.ts.
  const {
    preprocessors,
    className,
    loadingIndicator,
    resolveLink,
    settleTimeout = 3000,
    settleIndicator,
    ...environmentProps
  } = inputProps;
  // A renderer nested inside another one (a widget's own) keeps the outer one's links, unless given
  // its own.
  const outerResolveLink = useContext(resolveLinkContext);
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
        {/* Above the interface strings and the Environment, so their loading is held back too. */}
        <SettleGate
          timeout={settleTimeout}
          indicator={settleIndicator ?? loadingIndicator ?? undefined}
        >
          <loadingIndicatorContext.Provider value={loadingIndicator}>
            <resolveLinkContext.Provider value={resolveLink ?? outerResolveLink}>
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
            </resolveLinkContext.Provider>
          </loadingIndicatorContext.Provider>
        </SettleGate>
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
  // Its own boundary inside the SettleGate, so the mode's chunk loading counts as pending there.
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ModeComponent className={className} />
    </Suspense>
  );
}
