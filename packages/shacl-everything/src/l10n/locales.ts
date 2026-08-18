import type { BCP47 } from "@/types/BCP47.ts";

export const DEFAULT_LOCALE: BCP47 = "en-GB";

const fetchText = async (url: URL): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url.href}: ${response.status} ${response.statusText}`);
  }
  return response.text();
};

export type LocaleLoader = () => Promise<string>;

// The shape of the `interfaceLocales` prop on ShaclRenderer: a custom loader for a tag adds a
// brand new locale or overrides a built-in one with the caller's own translation, and `null`
// removes a built-in entirely - e.g. to ship with just one interface language and no switcher.
export type LocaleLoaderOverrides = Record<string, LocaleLoader | null>;

// Locales shipped with the library out of the box. Consumers can add further locales, override
// these, or remove one - via the `interfaceLocales` prop on ShaclRenderer (see loadBundles.ts).
export const builtInLocaleLoaders: Record<string, LocaleLoader> = {
  "en-GB": () => fetchText(new URL("./ftl/en-GB.ftl", import.meta.url)),
  "nl-NL": () => fetchText(new URL("./ftl/nl-NL.ftl", import.meta.url)),
};

// Layers `customLocales` over the built-ins, dropping any tag whose final value is `null` (a
// caller's explicit removal) rather than leaving it in as a falsy loader.
export const mergeLocaleLoaders = (
  customLocales: LocaleLoaderOverrides = {},
): Record<string, LocaleLoader> => {
  const merged: LocaleLoaderOverrides = { ...builtInLocaleLoaders, ...customLocales };
  const result: Record<string, LocaleLoader> = {};
  for (const [locale, loader] of Object.entries(merged)) {
    if (loader) result[locale] = loader;
  }
  return result;
};

const primarySubtag = (locale: string) => locale.split("-")[0]?.toLowerCase();

// Resolves a requested locale to one present in `loaders`, falling back to
// a locale that shares the same primary language subtag (e.g. "nl" -> "nl-NL").
export const resolveLocale = (
  locale: string,
  loaders: Record<string, LocaleLoader>,
): string | undefined => {
  if (locale in loaders) return locale;
  const primary = primarySubtag(locale);
  return Object.keys(loaders).find((code) => primarySubtag(code) === primary);
};
