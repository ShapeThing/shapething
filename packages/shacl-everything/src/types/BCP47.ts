type LanguageSubtag =
  | `${Lowercase<string>}${Lowercase<string>}`
  | `${Lowercase<string>}${Lowercase<string>}${Lowercase<string>}`;
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
