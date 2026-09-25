import React, { Suspense, useMemo } from "react";
import { Loading } from "@/helpers/icons.tsx";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Environment, RawEnvironment } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";
import {
  runPreprocessorsDeduped,
  defaultPreprocessors,
  type Preprocessor,
} from "@/preprocess/index.ts";
import { environmentContext } from "@/outputs/render/contexts/environmentContext.tsx";
import ContentLanguageProvider from "@/outputs/render/contexts/ContentLanguageProvider.tsx";
import { Localized } from "@fluent/react";
import { noRefetch } from "@/helpers/noRefetch.ts";
import type { LiveProps } from "@/outputs/render/environmentProps.ts";
import "./style.css";

type Props = Partial<RawEnvironment> & {
  preprocessors?: readonly Preprocessor[];
  children: React.ReactNode;
  instanceId: string;
  // Merged over the preprocessed Environment on every render - see environmentProps.ts. Identity
  // props are only read once per mount: ShaclRenderer remounts this provider (via `key`) when one
  // changes, since dataGraph becomes a live store widgets edit in place.
  liveProps?: LiveProps;
};

export default function EnvironmentContextProvider({
  children,
  preprocessors,
  instanceId,
  liveProps,
  ...props
}: Props) {
  const steps = preprocessors ?? defaultPreprocessors;
  const initialEnvironment = useMemo<RawEnvironment>(
    () => ({ ...defaultEnvironment, ...props }) as RawEnvironment,
    [],
  );

  const run: () => Promise<Environment> = () => runPreprocessorsDeduped(initialEnvironment, steps);

  return (
    <Suspense
      fallback={
        <div className="st-environment-context-provider__loading">
          <Localized id="loading" />
          <Loading />
        </div>
      }
    >
      <PreprocessedEnvironmentProvider id={instanceId} run={run} liveProps={liveProps}>
        {children}
      </PreprocessedEnvironmentProvider>
    </Suspense>
  );
}

function PreprocessedEnvironmentProvider({
  id,
  children,
  run,
  liveProps,
}: {
  id: string;
  children: React.ReactNode;
  run: () => Promise<Environment>;
  liveProps?: LiveProps;
}) {
  const { data: preprocessed } = useSuspenseQuery({
    queryKey: ["preprocess-environment", id],
    ...noRefetch,
    queryFn: run,
  });
  const environment = useMemo(
    () => (liveProps ? { ...preprocessed, ...liveProps } : preprocessed),
    [preprocessed, liveProps],
  );

  return (
    <environmentContext.Provider value={environment}>
      <ContentLanguageProvider>{children}</ContentLanguageProvider>
    </environmentContext.Provider>
  );
}
