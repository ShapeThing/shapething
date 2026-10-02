import { expect, test, vi } from "vite-plus/test";
import type { FluentBundle } from "@fluent/bundle";
import { loadBundles } from "@/l10n/loadBundles.ts";
import { DEFAULT_LOCALE } from "@/l10n/locales.ts";

const message = (bundle: FluentBundle, id: string) => {
  const pattern = bundle.getMessage(id)?.value;
  return pattern ? bundle.formatPattern(pattern) : undefined;
};

test("loadBundles - the default locale alone yields just the one bundle", async () => {
  const bundles = await loadBundles("en-GB");
  expect(bundles.map((b) => b.locales[0])).toEqual([DEFAULT_LOCALE]);
  expect(message(bundles[0]!, "node-ui-submit-create")).toEqual("Create");
});

test("loadBundles - a non-default locale comes first, followed by the DEFAULT_LOCALE fallback", async () => {
  const bundles = await loadBundles("nl-NL");
  expect(bundles.map((b) => b.locales[0])).toEqual(["nl-NL", DEFAULT_LOCALE]);
  expect(message(bundles[0]!, "node-ui-submit-create")).toEqual("Aanmaken");
});

test("loadBundles - negotiates by primary subtag (nl -> nl-NL)", async () => {
  const bundles = await loadBundles("nl");
  expect(bundles.map((b) => b.locales[0])).toEqual(["nl-NL", DEFAULT_LOCALE]);
});

test("loadBundles - an unknown locale still resolves, to just the DEFAULT_LOCALE fallback", async () => {
  const bundles = await loadBundles("fr-FR");
  expect(bundles.map((b) => b.locales[0])).toEqual([DEFAULT_LOCALE]);
});

test("loadBundles - a custom locale is loaded ahead of the DEFAULT_LOCALE fallback", async () => {
  const bundles = await loadBundles("fr-FR", {
    "fr-FR": () => Promise.resolve("node-ui-submit-create = Créer"),
  });
  expect(bundles.map((b) => b.locales[0])).toEqual(["fr-FR", DEFAULT_LOCALE]);
  expect(message(bundles[0]!, "node-ui-submit-create")).toEqual("Créer");
});

test("loadBundles - with DEFAULT_LOCALE removed, the remaining locale becomes the fallback", async () => {
  const bundles = await loadBundles("nl-NL", { "en-GB": null });
  expect(bundles.map((b) => b.locales[0])).toEqual(["nl-NL"]);
  const unknown = await loadBundles("fr-FR", { "en-GB": null });
  expect(unknown.map((b) => b.locales[0])).toEqual(["nl-NL"]);
});

test("loadBundles - a removed built-in locale requested anyway still loads its built-in translation", async () => {
  const bundles = await loadBundles("nl-NL", { "nl-NL": null });
  expect(bundles.map((b) => b.locales[0])).toEqual(["nl-NL", DEFAULT_LOCALE]);
  expect(message(bundles[0]!, "node-ui-submit-create")).toEqual("Aanmaken");
});

test("loadBundles - caches bundles: the same loader + locale is only loaded once", async () => {
  const loader = vi.fn(() => Promise.resolve("greeting = Hallo"));
  const first = await loadBundles("de-DE", { "de-DE": loader });
  const second = await loadBundles("de-DE", { "de-DE": loader });
  expect(loader).toHaveBeenCalledTimes(1);
  expect(second[0]).toBe(first[0]);
  // The built-in fallback bundle is shared across calls, too.
  expect(second[1]).toBe(first[1]);
});

test("loadBundles - the cache is keyed by loader, not just locale tag: an override of a cached built-in gets its own bundle", async () => {
  const [builtIn] = await loadBundles("en-GB");
  const [overridden] = await loadBundles("en-GB", {
    "en-GB": () => Promise.resolve("node-ui-submit-create = Make it so"),
  });
  expect(overridden).not.toBe(builtIn);
  expect(message(overridden!, "node-ui-submit-create")).toEqual("Make it so");
  // ...and the built-in's cached bundle is left untouched by the override.
  const [builtInAgain] = await loadBundles("en-GB");
  expect(builtInAgain).toBe(builtIn);
  expect(message(builtInAgain!, "node-ui-submit-create")).toEqual("Create");
});

test("loadBundles - two different loaders for the same new tag each get their own bundle", async () => {
  const [a] = await loadBundles("es-ES", { "es-ES": () => Promise.resolve("x = A") });
  const [b] = await loadBundles("es-ES", { "es-ES": () => Promise.resolve("x = B") });
  expect(message(a!, "x")).toEqual("A");
  expect(message(b!, "x")).toEqual("B");
});

test("loadBundles - a rejected load is evicted from the cache, so the next call retries", async () => {
  const loader = vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce("x = recovered");
  await expect(loadBundles("it-IT", { "it-IT": loader })).rejects.toThrow("network down");
  const [bundle] = await loadBundles("it-IT", { "it-IT": loader });
  expect(loader).toHaveBeenCalledTimes(2);
  expect(message(bundle!, "x")).toEqual("recovered");
});
