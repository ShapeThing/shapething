import type { BCP47 } from "@/types/BCP47.ts";

export const DEFAULT_LOCALE: BCP47 = "en-GB";

const fetchText = async (url: URL): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url.href}: ${response.status} ${response.statusText}`);
  }
  return response.text();
};

export const localeLoaders: Record<string, () => Promise<string>> = {
  "en-GB": () => fetchText(new URL("./ftl/en-GB.ftl", import.meta.url)),
  "nl-NL": () => fetchText(new URL("./ftl/nl-NL.ftl", import.meta.url)),
};

const primarySubtag = (locale: string) => locale.split("-")[0]?.toLowerCase();

// Resolves a requested locale to one we have a resource for, falling back to
// a locale that shares the same primary language subtag (e.g. "nl" -> "nl-NL").
export const resolveLocale = (locale: string): string | undefined => {
  if (locale in localeLoaders) return locale;
  const primary = primarySubtag(locale);
  return Object.keys(localeLoaders).find((code) => primarySubtag(code) === primary);
};
