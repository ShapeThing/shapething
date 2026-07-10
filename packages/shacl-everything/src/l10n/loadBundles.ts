import { FluentBundle, FluentResource } from "@fluent/bundle";
import type { BCP47 } from "@/types/BCP47.ts";
import { DEFAULT_LOCALE, localeLoaders, resolveLocale } from "@/l10n/locales.ts";

const bundleCache = new Map<string, Promise<FluentBundle>>();

const buildBundle = async (locale: string): Promise<FluentBundle> => {
  const source = await localeLoaders[locale]!();
  const bundle = new FluentBundle(locale);
  bundle.addResource(new FluentResource(source));
  return bundle;
};

const getBundle = (locale: string): Promise<FluentBundle> => {
  let bundle = bundleCache.get(locale);
  if (!bundle) {
    bundle = buildBundle(locale);
    bundleCache.set(locale, bundle);
  }
  return bundle;
};

// Returns bundles in fallback order: the negotiated locale first (if it isn't
// the default), then the default locale so lookups always resolve.
export const loadBundles = async (interfaceLanguage: BCP47): Promise<FluentBundle[]> => {
  const resolved = resolveLocale(interfaceLanguage);
  const locales =
    resolved && resolved !== DEFAULT_LOCALE ? [resolved, DEFAULT_LOCALE] : [DEFAULT_LOCALE];
  return Promise.all(locales.map(getBundle));
};
