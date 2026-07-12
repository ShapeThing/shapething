import React, { Suspense, useMemo } from "react";
import { Loading } from "@/helpers/icons.tsx";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Environment, RawEnvironment } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";
import { runPreprocessors, defaultPreprocessors, type Preprocessor } from "@/preprocess/index.ts";
import { environmentContext } from "@/outputs/render/contexts/environmentContext.tsx";
import { Localized } from "@fluent/react";
import { noRefetch } from "@/helpers/noRefetch.ts";

type Props = Partial<RawEnvironment> & {
  preprocessors?: readonly Preprocessor[];
  children: React.ReactNode;
  instanceId: string;
};

export default function EnvironmentContextProvider({
  children,
  preprocessors,
  instanceId,
  ...props
}: Props) {
  const steps = preprocessors ?? defaultPreprocessors;
  const initialEnvironment = useMemo<RawEnvironment>(
    () => ({ ...defaultEnvironment, ...props }) as RawEnvironment,
    [],
  );

  const run: () => Promise<Environment> = () => runPreprocessors(initialEnvironment, steps);

  return (
    <Suspense
      fallback={
        <>
          <Localized id="loading" />
          <Loading />
        </>
      }
    >
      <PreprocessedEnvironmentProvider id={instanceId} run={run}>
        {children}
      </PreprocessedEnvironmentProvider>
    </Suspense>
  );
}

function PreprocessedEnvironmentProvider({
  id,
  children,
  run,
}: {
  id: string;
  children: React.ReactNode;
  run: () => Promise<Environment>;
}) {
  const { data: environment } = useSuspenseQuery({
    queryKey: ["preprocess-environment", id],
    ...noRefetch,
    queryFn: run,
  });

  return <environmentContext.Provider value={environment}>{children}</environmentContext.Provider>;
}
