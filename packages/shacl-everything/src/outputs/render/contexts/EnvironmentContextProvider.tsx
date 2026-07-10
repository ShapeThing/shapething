import React, { Suspense, useId, useMemo, useState } from "react";
import { Loading } from "@/helpers/icons.tsx";
import { QueryClient, QueryClientProvider, useSuspenseQuery } from "@tanstack/react-query";
import { defaultEnvironment, type Environment } from "@/environment.ts";
import { environmentContext } from "@/outputs/render/contexts/environmentContext.tsx";
import { runPreprocessors } from "@/preprocess/index.ts";

type Props = Partial<Environment> & {
  children: React.ReactNode;
};

export default function EnvironmentContextProvider({ children, ...props }: Props) {
  const [queryClient] = useState(() => new QueryClient());
  const id = useId();

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<Loading />}>
        <PreprocessedEnvironmentProvider id={id} {...props}>
          {children}
        </PreprocessedEnvironmentProvider>
      </Suspense>
    </QueryClientProvider>
  );
}

function PreprocessedEnvironmentProvider({ id, children, ...props }: Props & { id: string }) {
  const initialEnvironment = useMemo<Environment>(() => ({ ...defaultEnvironment, ...props }), []);

  const { data: environment } = useSuspenseQuery({
    queryKey: ["preprocess-environment", id],
    queryFn: () =>
      runPreprocessors(initialEnvironment, props.preprocessors || defaultEnvironment.preprocessors),
  });

  return <environmentContext.Provider value={environment}>{children}</environmentContext.Provider>;
}
