import React, { Suspense, useMemo } from "react";
import { Loading } from "@/helpers/icons.tsx";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Environment } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";
import {
  runPreprocessors,
  defaultPreprocessors,
  type Preprocessor,
  type PipelineInput,
  type RequireValidChain,
} from "@/preprocess/index.ts";
import { environmentContext } from "@/outputs/render/contexts/environmentContext.tsx";
import { Localized } from "@fluent/react";

type DefaultPreprocessors = typeof defaultPreprocessors;

type Props<Steps extends readonly Preprocessor<any, any>[]> = Partial<PipelineInput<Steps>> & {
  preprocessors?: Steps;
  children: React.ReactNode;
  instanceId: string;
} & RequireValidChain<Steps>;

export default function EnvironmentContextProvider<
  const Steps extends readonly Preprocessor<any, any>[] = DefaultPreprocessors,
>({ children, preprocessors, instanceId, ...props }: Props<Steps>) {
  const steps = (preprocessors ?? defaultPreprocessors) as Steps;
  const initialEnvironment = useMemo<PipelineInput<Steps>>(
    () => ({ ...defaultEnvironment, ...props }) as PipelineInput<Steps>,
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
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    queryFn: run,
  });

  return <environmentContext.Provider value={environment}>{children}</environmentContext.Provider>;
}
