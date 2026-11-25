import React, { Suspense, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import { LoadingFallback } from "@/outputs/render/contexts/loadingIndicatorContext.tsx";
import type { BCP47 } from "@/types/BCP47.ts";
import { loadBundles } from "@/l10n/loadBundles.ts";
import type { LocaleLoaderOverrides } from "@/l10n/locales.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";

type Props = {
  children: React.ReactNode;
  // Caller-supplied locales (ShaclRenderer's `interfaceLocales` prop), layered over the built-in
  // ones. Threaded in directly rather than read via useEnvironment, since this provider sits
  // above EnvironmentContextProvider in the tree (its own loading state needs Localized ids
  // to already be available).
  interfaceLocales?: LocaleLoaderOverrides;
};

// Reads the active interface language from context (see InterfaceLanguageProvider) rather than
// a static prop, so switching it via InterfaceLanguageSwitcher re-negotiates and loads the newly
// active locale's bundle - the current one stays up meanwhile.
export default function L10nProvider({ children, interfaceLocales }: Props) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NegotiatedLocalizationProvider
        interfaceLanguage={activeInterfaceLanguage}
        interfaceLocales={interfaceLocales}
      >
        {children}
      </NegotiatedLocalizationProvider>
    </Suspense>
  );
}

function NegotiatedLocalizationProvider({
  interfaceLanguage,
  interfaceLocales,
  children,
}: Props & { interfaceLanguage: BCP47 }) {
  // Not a suspending query: React holds back revealing suspended content until 300ms after its
  // fallback appeared, so on a first load that resolves sooner the form would wait for nothing.
  // A plain loading state commits as soon as the bundles are in.
  const { data: bundles } = useQuery({
    queryKey: ["l10n-bundles", interfaceLanguage],
    ...noRefetch,
    queryFn: () => loadBundles(interfaceLanguage, interfaceLocales),
    placeholderData: keepPreviousData,
    throwOnError: true,
  });

  const l10n = useMemo(() => bundles && new ReactLocalization(bundles), [bundles]);
  if (!l10n) return <LoadingFallback />;
  return <LocalizationProvider l10n={l10n}>{children}</LocalizationProvider>;
}
