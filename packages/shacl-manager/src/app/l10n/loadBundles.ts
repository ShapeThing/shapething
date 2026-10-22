import { FluentBundle, FluentResource } from "@fluent/bundle";
import {
  DEFAULT_LOCALE,
  mergeLocaleLoaders,
  resolveLocale,
  type LocaleLoader,
  type LocaleLoaderOverrides,
} from "@/app/l10n/locales.ts";

const bundleCache = new Map<string, Promise<FluentBundle>>();

const buildBundle = async (locale: string, loader: LocaleLoader): Promise<FluentBundle> => {
  const source = await loader();
  // No bidi isolation marks: every placeable here is an RDF label inside left-to-right UI text.
  const bundle = new FluentBundle(locale, { useIsolating: false });
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
// ShaclManager) are layered over the built-ins - see mergeLocaleLoaders. The fallback is
// DEFAULT_LOCALE, unless a caller has removed it, in which case whatever locale remains is used
// instead so a single remaining locale still works.
export const loadBundles = async (
  interfaceLanguage: string,
  customLocales: LocaleLoaderOverrides = {},
): Promise<FluentBundle[]> => {
  const loaders = mergeLocaleLoaders(customLocales);
  const fallback = DEFAULT_LOCALE in loaders ? DEFAULT_LOCALE : Object.keys(loaders)[0]!;

  const resolved = resolveLocale(interfaceLanguage, loaders);
  const locales = resolved && resolved !== fallback ? [resolved, fallback] : [fallback];
  return Promise.all(locales.map((locale) => getBundle(locale, loaders[locale]!)));
};
