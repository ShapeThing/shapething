import React, { createContext, useContext, useLayoutEffect } from "react";
import { Loading } from "@/helpers/icons.tsx";

/**
 * What the renderer's own Suspense boundaries show while something loads (ShaclRenderer's
 * `loadingIndicator` prop). `undefined` keeps the built-in spinner, `null` shows nothing, and any
 * other node replaces the spinner everywhere. Its own context rather than part of the Environment,
 * since the outermost boundaries (L10nProvider's, EnvironmentContextProvider's) sit above it.
 */
export const loadingIndicatorContext = createContext<React.ReactNode | undefined>(undefined);

/**
 * Lets every Suspense fallback below a SettleGate (via LoadingFallback) report that it is showing,
 * so the gate knows a lazy widget or suspending query is still pending - react-query's
 * useIsFetching only sees queries, not React.lazy chunks.
 */
export const settleGateContext = createContext<{ register: () => () => void } | undefined>(
  undefined,
);

/**
 * Whether the nearest SettleGate has opened (always true outside one). While it hasn't, the form is
 * `inert` and invisible, so anything focusing an element on mount (an empty SubClassEditor opening
 * its tree, a widget's autoFocus) has to wait for this to turn true - focus() on an inert element
 * silently does nothing.
 */
export function useSettled() {
  return useContext(settleGateContext) === undefined;
}

/** Registers the calling fallback as pending with the nearest SettleGate while it is mounted. */
export function useRegisterPending() {
  const gate = useContext(settleGateContext);
  useLayoutEffect(() => gate?.register(), [gate]);
}

/**
 * A Suspense fallback honoring ShaclRenderer's `loadingIndicator` prop. `children` is the built-in
 * fallback, shown when no indicator was given; it defaults to the spinner icon.
 */
export function LoadingFallback({ children }: { children?: React.ReactNode }) {
  const indicator = useContext(loadingIndicatorContext);
  useRegisterPending();
  if (indicator !== undefined) return <>{indicator}</>;
  return <>{children ?? <Loading />}</>;
}
