import { FluentBundle, FluentResource } from "@fluent/bundle";
import type { BCP47 } from "@/types/BCP47.ts";
import {
  builtInLocaleLoaders,
  DEFAULT_LOCALE,
  mergeLocaleLoaders,
  resolveLocale,
  type LocaleLoader,
  type LocaleLoaderOverrides,
} from "@/l10n/locales.ts";

const bundleCache = new Map<string, Promise<FluentBundle>>();

const buildBundle = async (locale: string, loader: LocaleLoader): Promise<FluentBundle> => {
  const source = await loader();
  const bundle = new FluentBundle(locale);
  bundle.addResource(new FluentResource(source));
  return bundle;
};

const getBundle = (locale: string, loader: LocaleLoader): Promise<FluentBundle> => {
  let bundle = bundleCache.get(locale);
  if (!bundle) {
    bundle = buildBundle(locale, loader);
    bundleCache.set(locale, bundle);
  }
  return bundle;
};

// Returns bundles in fallback order: the negotiated locale first (if it isn't the fallback), then
// the fallback locale so lookups always resolve. `customLocales` (the `interfaceLocales` prop on
// ShaclRenderer) are layered over the built-ins - see mergeLocaleLoaders. The fallback is
// DEFAULT_LOCALE, unless a caller has removed it, in which case whatever locale remains is used
// instead so a single remaining locale still works.
export const loadBundles = async (
  interfaceLanguage: BCP47,
  customLocales: LocaleLoaderOverrides = {},
): Promise<FluentBundle[]> => {
  const loaders = mergeLocaleLoaders(customLocales);
  const fallback = DEFAULT_LOCALE in loaders ? DEFAULT_LOCALE : Object.keys(loaders)[0]!;

  // A locale explicitly removed via `interfaceLocales` (e.g. `{ "nl-NL": null }`) is ordinarily
  // just gone - but Environment.enableInterfaceLanguageWithShapesLabelsOnly can still resurrect it
  // into interfaceLanguages (see preprocess/languages.ts) purely because the shapes graph itself
  // carries sh:name/sh:description labels in it. When that happens, the library's own built-in
  // translation for it - if it ships one - is still the right thing to load, rather than silently
  // leaving every FTL-driven string in the fallback language while shape-derived labels follow the
  // resurrected one.
  let resolved = resolveLocale(interfaceLanguage, loaders);
  let effectiveLoaders = loaders;
  if (!resolved) {
    resolved = resolveLocale(interfaceLanguage, builtInLocaleLoaders);
    if (resolved) effectiveLoaders = { ...loaders, [resolved]: builtInLocaleLoaders[resolved] };
  }

  const locales = resolved && resolved !== fallback ? [resolved, fallback] : [fallback];
  return Promise.all(locales.map((locale) => getBundle(locale, effectiveLoaders[locale]!)));
};
