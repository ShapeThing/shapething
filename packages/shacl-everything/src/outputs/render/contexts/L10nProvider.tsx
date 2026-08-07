import React, { Suspense, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import { Loading } from "@/helpers/icons.tsx";
import type { BCP47 } from "@/types/BCP47.ts";
import { loadBundles } from "@/l10n/loadBundles.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";

type Props = { children: React.ReactNode };

// Reads the active interface language from context (see InterfaceLanguageProvider) rather than
// a static prop, so switching it via InterfaceLanguageSwitcher re-negotiates and loads the newly
// active locale's bundle - the Suspense boundary below covers that reload the same way it covers
// the very first load.
export default function L10nProvider({ children }: Props) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  return (
    <Suspense fallback={<Loading />}>
      <NegotiatedLocalizationProvider interfaceLanguage={activeInterfaceLanguage}>
        {children}
      </NegotiatedLocalizationProvider>
    </Suspense>
  );
}

function NegotiatedLocalizationProvider({
  interfaceLanguage,
  children,
}: Props & { interfaceLanguage: BCP47 }) {
  const { data: bundles } = useSuspenseQuery({
    queryKey: ["l10n-bundles", interfaceLanguage],
    ...noRefetch,
    queryFn: () => loadBundles(interfaceLanguage),
  });

  const l10n = useMemo(() => new ReactLocalization(bundles), [bundles]);
  return <LocalizationProvider l10n={l10n}>{children}</LocalizationProvider>;
}
