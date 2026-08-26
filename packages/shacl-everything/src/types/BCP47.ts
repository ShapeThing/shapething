// Lowercase is the BCP47 convention, but the primary subtag is case-insensitive (RFC 5646 §2.1),
// so a consistently-uppercase tag like "EN" is modeled too - just not a mixed-case one.
type LanguageSubtag =
  | `${Lowercase<string>}${Lowercase<string>}`
  | `${Lowercase<string>}${Lowercase<string>}${Lowercase<string>}`
  | `${Uppercase<string>}${Uppercase<string>}`
  | `${Uppercase<string>}${Uppercase<string>}${Uppercase<string>}`;
type ScriptSubtag =
  `${Uppercase<string>}${Lowercase<string>}${Lowercase<string>}${Lowercase<string>}`;
type RegionSubtag = `${Uppercase<string>}${Uppercase<string>}` | `${number}${number}${number}`;

// Covers the common language[-script][-region] shapes (e.g. "en", "en-GB", "zh-Hans-CN").
// Variant/extension/private-use subtags are intentionally not modeled.
export type BCP47 =
  | LanguageSubtag
  | `${LanguageSubtag}-${ScriptSubtag}`
  | `${LanguageSubtag}-${RegionSubtag}`
  | `${LanguageSubtag}-${ScriptSubtag}-${RegionSubtag}`;

// Everywhere a caller's own preferred languages meet shui:languagePreference (spec 3.4/8.1): the
// global config list may contain "" to mean "no language" (a plain literal with Literal.language
// === ""), which BCP47 itself cannot express - LanguageRange is the widened type used only where
// that merged/config-sourced list flows through (bestByLanguage, language(), get()'s language
// overload). Caller-supplied language arrays (e.g. [activeInterfaceLanguage]) stay typed BCP47[].
export type LanguageRange = BCP47 | "";
