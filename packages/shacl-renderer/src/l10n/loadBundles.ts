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

// Keyed by loader identity first, then locale tag: the same tag can be served by different loaders
// over a page's lifetime (a built-in, or an embedder's `interfaceLocales` override of it - possibly
// differing between two ShaclRenderer mounts), and each must get its own bundle rather than
// whichever one happened to be cached first. A WeakMap so a discarded custom loader's bundles can
// be garbage-collected along with it.
const bundleCache = new WeakMap<LocaleLoader, Map<string, Promise<FluentBundle>>>();

const buildBundle = async (locale: string, loader: LocaleLoader): Promise<FluentBundle> => {
  const source = await loader();
  const bundle = new FluentBundle(locale);
  bundle.addResource(new FluentResource(source));
  return bundle;
};

const getBundle = (locale: string, loader: LocaleLoader): Promise<FluentBundle> => {
  let byLocale = bundleCache.get(loader);
  if (!byLocale) {
    byLocale = new Map();
    bundleCache.set(loader, byLocale);
  }
  const cached = byLocale.get(locale);
  if (cached) return cached;

  const bundle = buildBundle(locale, loader);
  byLocale.set(locale, bundle);
  // Evict a failed load (e.g. a transient network error in a custom fetching loader) so the next
  // request retries instead of replaying the same rejection forever. Guarded so a newer entry that
  // replaced this one in the meantime isn't evicted by mistake. The rejection itself still reaches
  // the caller through the returned promise.
  const entries = byLocale;
  bundle.catch(() => {
    if (entries.get(locale) === bundle) entries.delete(locale);
  });
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
