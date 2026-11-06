import React, { createContext, useContext } from "react";
import { Loading } from "@/helpers/icons.tsx";

/**
 * What the renderer's own Suspense boundaries show while something loads (ShaclRenderer's
 * `loadingIndicator` prop). `undefined` keeps the built-in spinner, `null` shows nothing, and any
 * other node replaces the spinner everywhere. Its own context rather than part of the Environment,
 * since the outermost boundaries (L10nProvider's, EnvironmentContextProvider's) sit above it.
 */
export const loadingIndicatorContext = createContext<React.ReactNode | undefined>(undefined);

/**
 * A Suspense fallback honoring ShaclRenderer's `loadingIndicator` prop. `children` is the built-in
 * fallback, shown when no indicator was given; it defaults to the spinner icon.
 */
export function LoadingFallback({ children }: { children?: React.ReactNode }) {
  const indicator = useContext(loadingIndicatorContext);
  if (indicator !== undefined) return <>{indicator}</>;
  return <>{children ?? <Loading />}</>;
}
