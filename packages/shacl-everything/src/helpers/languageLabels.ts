import type { BCP47 } from "@/types/BCP47.ts";

const primarySubtag = (code: string) => code.split("-")[0];

// Base language name only (no region/script), named in `displayLocale`, e.g. "en-GB" -> "English"
// when displayLocale is "en", or -> "Engels" when displayLocale is "nl".
// Intl.DisplayNames throws for malformed tags (e.g. "e", "123") - fall back to the raw code.
const baseAutonym = (code: BCP47, displayLocale: string): string => {
  const primary = primarySubtag(code);
  try {
    return new Intl.DisplayNames([displayLocale], { type: "language" }).of(primary) ?? code;
  } catch {
    return code;
  }
};

// Human-readable region/script qualifier for a tag, named in `displayLocale`, e.g.
// "en-GB" -> "United Kingdom", "zh-Hans-CN" -> "Simplified, China". Empty string if the tag
// carries neither.
const qualifier = (code: BCP47, displayLocale: string): string => {
  const subtags = code.split("-").slice(1);
  const script = subtags.find((tag) => /^[A-Z][a-z]{3}$/.test(tag));
  const region = subtags.find((tag) => /^[A-Z]{2}$|^\d{3}$/.test(tag));
  const parts: string[] = [];
  try {
    if (script)
      parts.push(new Intl.DisplayNames([displayLocale], { type: "script" }).of(script) ?? script);
    if (region)
      parts.push(new Intl.DisplayNames([displayLocale], { type: "region" }).of(region) ?? region);
  } catch {
    // best-effort - fall through with whatever was collected before the throw
  }
  return parts.join(", ");
};

// Language label per code in `codes`, named in `displayLocale` - e.g. with displayLocale "nl",
// ["en-GB", "nl-NL"] -> "Engels" / "Nederlands". Omit displayLocale to get each language's own
// autonym instead (e.g. "en-GB" -> "English" regardless of who's reading) - the right choice for
// a language picker that must stay legible no matter what it's currently set to, as opposed to a
// content-language picker, which should read in whichever language the viewer already has
// selected. A region/script qualifier is appended only for codes whose base language name
// collides with another code in the same list (e.g. "en-GB" and "en-US" both present ->
// "English (United Kingdom)" / "English (United States)"); a lone "en-GB" in the list stays
// plain "English".
export function languageLabels(codes: BCP47[], displayLocale?: BCP47): Record<BCP47, string> {
  const localeFor = (code: BCP47) => displayLocale ?? primarySubtag(code);
  const bases = codes.map((code) => baseAutonym(code, localeFor(code)));
  const counts = new Map<string, number>();
  for (const base of bases) counts.set(base, (counts.get(base) ?? 0) + 1);

  const labels: Record<string, string> = {};
  codes.forEach((code, i) => {
    const base = bases[i];
    if ((counts.get(base) ?? 0) <= 1) {
      labels[code] = base;
      return;
    }
    const q = qualifier(code, localeFor(code));
    labels[code] = `${base} (${q || code})`;
  });
  return labels as Record<BCP47, string>;
}
