import { expect, test } from "vite-plus/test";
import { languageLabels } from "@/helpers/languageLabels.ts";

test("languageLabels - plain autonym when base languages are all distinct", () => {
  expect(languageLabels(["en-GB", "nl-NL"])).toEqual({
    "en-GB": "English",
    "nl-NL": "Nederlands",
  });
});

test("languageLabels - qualifies with region when base language collides", () => {
  expect(languageLabels(["en-GB", "en-US"])).toEqual({
    "en-GB": "English (United Kingdom)",
    "en-US": "English (United States)",
  });
});

test("languageLabels - qualifies with script and region when base language collides", () => {
  expect(languageLabels(["zh-Hans-CN", "zh-Hant-TW"])).toEqual({
    "zh-Hans-CN": "中文 (简体, 中国)",
    "zh-Hant-TW": "中文 (繁体, 台湾)",
  });
});

test("languageLabels - bare language-only tag resolves to its autonym with no qualifier", () => {
  expect(languageLabels(["en"])).toEqual({ en: "English" });
});

test("languageLabels - falls back to the raw code for a malformed tag instead of throwing", () => {
  expect(languageLabels(["e"])).toEqual({ e: "e" });
});

test("languageLabels - names every language in displayLocale instead of its own autonym", () => {
  expect(languageLabels(["en-GB", "nl-NL", "fr-FR"], "nl")).toEqual({
    "en-GB": "Engels",
    "nl-NL": "Nederlands",
    "fr-FR": "Frans",
  });
});
