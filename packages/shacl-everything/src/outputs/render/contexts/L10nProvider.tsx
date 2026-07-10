import React, { Suspense, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import { Loading } from "@/helpers/icons.tsx";
import type { BCP47 } from "@/types/BCP47.ts";
import { loadBundles } from "@/l10n/loadBundles.ts";

type Props = { interfaceLanguage: BCP47; children: React.ReactNode };

export default function L10nProvider({ interfaceLanguage, children }: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <NegotiatedLocalizationProvider interfaceLanguage={interfaceLanguage}>
        {children}
      </NegotiatedLocalizationProvider>
    </Suspense>
  );
}

function NegotiatedLocalizationProvider({ interfaceLanguage, children }: Props) {
  const { data: bundles } = useSuspenseQuery({
    queryKey: ["l10n-bundles", interfaceLanguage],
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
    queryFn: () => loadBundles(interfaceLanguage),
  });

  const l10n = useMemo(() => new ReactLocalization(bundles), [bundles]);
  return <LocalizationProvider l10n={l10n}>{children}</LocalizationProvider>;
}
