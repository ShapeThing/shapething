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
import { tabSelectionContext } from "@/outputs/render/contexts/tabbedPropertyGroupContext.tsx";
import InterfaceLanguageProvider from "@/outputs/render/contexts/InterfaceLanguageProvider.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { identityKey, pickLiveProps } from "@/outputs/render/environmentProps.ts";
import {
  Suspense,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ErrorBoundary, getErrorMessage } from "react-error-boundary";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { RdfStore } from "rdf-stores";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
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
  // The st:TabbedPropertyGroup to show (its IRI), and what to call when the user picks another - so
  // an embedder can keep the tab in its URL. Without it the renderer keeps the tab itself. Not part
  // of the Environment: a new tab only re-renders the tabs.
  activeTab?: string;
  onTabChange?: (tab: string) => void;
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
    activeTab,
    onTabChange,
    settleTimeout = 3000,
    settleIndicator,
    ...environmentProps
  } = inputProps;
  // A renderer nested inside another one (a widget's own) keeps the outer one's links, unless given
  // its own.
  const outerResolveLink = useContext(resolveLinkContext);
  const tabSelection = useMemo(() => ({ activeTab, onTabChange }), [activeTab, onTabChange]);
  const identity = identityKey({ ...environmentProps, preprocessors });
  const instanceId = `${baseId}:${identity}`;

  // A fresh cache per identity, too: most query keys (e.g. useWidget's) are scoped by property
  // shape IRI rather than by Environment, so a new shapesGraph reusing the same IRIs would
  // otherwise get the previous session's widget picks back. When only the focusNode changed (an
  // embedder showing one node after another with the same shapes and data), the previous cache is
  // handed down, to carry over if the graphs come out of preprocessing the same - see
  // rendererSession.ts. Not in edit mode, where the previous session's dataGraph may hold edits,
  // nor for a live dataGraph, which may have changed since without a new identity.
  const liveDataGraph =
    environmentProps.dataGraph instanceof RdfStore &&
    getReactivity(environmentProps.dataGraph) !== undefined;
  const mode = environmentProps.mode ?? defaultEnvironment.mode;
  // The mode's chunk is only rendered once the interface strings and preprocessing are done, but
  // `mode` is known right now - so its download starts now, in parallel with both, instead of
  // after them. (import() is idempotent; the lazy() below then finds the module already loading.)
  void modeLoaders[mode]?.();
  const focuslessIdentity =
    mode !== "edit" && !liveDataGraph
      ? identityKey({ ...environmentProps, focusNode: undefined, preprocessors })
      : undefined;
  const [session, setSession] = useState(() => ({
    identity,
    focuslessIdentity,
    queryClient: new QueryClient(),
    previousClient: undefined as QueryClient | undefined,
  }));
  if (session.identity !== identity) {
    setSession({
      identity,
      focuslessIdentity,
      queryClient: new QueryClient(),
      previousClient:
        focuslessIdentity !== undefined && focuslessIdentity === session.focuslessIdentity
          ? session.queryClient
          : undefined,
    });
  }
  const { queryClient, previousClient } = session;
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
              <tabSelectionContext.Provider value={tabSelection}>
                <InterfaceLanguageProvider interfaceLanguage={interfaceLanguage}>
                  <L10nProvider interfaceLocales={interfaceLocales}>
                    <EnvironmentContextProvider
                      key={identity}
                      {...environmentProps}
                      preprocessors={preprocessors}
                      onSubmit={onSubmit}
                      liveProps={stableLiveProps}
                      instanceId={instanceId}
                      previousClient={previousClient}
                    >
                      <ShaclRendererInner className={className} />
                    </EnvironmentContextProvider>
                  </L10nProvider>
                </InterfaceLanguageProvider>
              </tabSelectionContext.Provider>
            </resolveLinkContext.Provider>
          </loadingIndicatorContext.Provider>
        </SettleGate>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const modeLoaders: Record<
  Environment["mode"],
  () => Promise<{ default: React.ComponentType<ModeProps> }>
> = {
  edit: () => import("@/outputs/render/modes/edit/index.tsx"),
  view: () => import("@/outputs/render/modes/view/index.tsx"),
  facet: () => import("@/outputs/render/modes/facet/index.tsx"),
  report: () => import("@/outputs/render/modes/report/index.tsx"),
};

// The mode's chunk is waited for through a query rather than React.lazy: lazy() suspends on first
// render even when the chunk is already in (its download starts in ShaclRenderer, see above), and
// React holds back revealing suspended content until 300ms after its fallback appeared - on a first
// load that is otherwise done sooner, the form would wait for nothing. The query counts as pending
// for the SettleGate the same way.
function ShaclRendererInner({ className }: ModeProps) {
  const { mode } = useEnvironment();
  const { data: ModeComponent } = useQuery({
    queryKey: ["mode-component", mode],
    queryFn: async () => (await modeLoaders[mode]()).default,
    ...noRefetch,
    throwOnError: true,
  });
  if (!ModeComponent) return <LoadingFallback />;
  // Still its own boundary inside the SettleGate, for anything below that does suspend.
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ModeComponent className={className} />
    </Suspense>
  );
}
