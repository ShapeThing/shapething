import { factory } from "@/helpers/factory.ts";
import type { RdfSource } from "@/types/RdfSource.ts";

// A production build never imports a fixture .ttl through ESM, so Vite has no reason to fingerprint
// it - copyStoryFixtures.ts (.storybook/) instead emits it flat/unhashed, matching the literal
// filename used here. Writing `new URL("some-fixture.ttl#frag", import.meta.url)` directly at a
// story call site looks equivalent but isn't: Vite's built-in import.meta.url asset handling *does*
// statically recognize that literal pattern and rewrites it to a separately content-hashed copy
// (`some-fixture-HASH.ttl`), which then silently 404s (or worse, points at a same-named but
// different file) against the un-hashed shapesGraph/dataGraph this same fixture resolves to via
// argsByTestFile below - only in a production build, never in dev, since dev serves src/ verbatim
// and never rewrites `new URL()` calls at all. Route any extra fixture-relative IRI (a nodeShape,
// a focusNode fragment, etc.) through this helper instead of writing `new URL(...)` inline.
export const fixtureUrl = (name: string, cwd: string): URL => new URL(name, cwd);

// readOnlyGraphFilename is a second, separate fixture file (see Environment.readOnlyGraph) -
// not another fragment of `filename` - since it's read as its own graph rather than merged into
// shapesGraph/dataGraph. It should reference the same focus node as `filename`'s `<#data>` via a
// relative IRI (e.g. `<foo.ttl#data>`, not `<#data>`), since `<#data>` inside the read-only file
// would instead resolve against that file's own URL.
//
// `filename`/`readOnlyGraphFilename` each accept one path or several: several are merged into a
// single shapesGraph/dataGraph (resp. readOnlyGraph) store. `<#shape>`/`<#data>` are always
// resolved against the *first* filename, since that's the fixture expected to declare them - the
// rest are supplementary (shared vocabulary, split-out shapes, etc).
export const argsByTestFile = (
  filename: string | readonly string[],
  cwd: string,
  readOnlyGraphFilename?: string | readonly string[],
) => {
  const filenames = Array.isArray(filename) ? filename : [filename as string];
  const [primaryFilename] = filenames;
  const toUrls = (names: readonly string[]) => names.map((name) => fixtureUrl(name, cwd));
  const graphSource = (names: readonly string[]): RdfSource => {
    const urls = toUrls(names);
    return urls.length === 1 ? urls[0] : urls;
  };

  return {
    shapesGraph: graphSource(filenames),
    nodeShapes: [factory.namedNode(fixtureUrl(`${primaryFilename}#shape`, cwd).href)],
    dataGraph: graphSource(filenames),
    focusNode: factory.namedNode(fixtureUrl(`${primaryFilename}#data`, cwd).href),
    ...(readOnlyGraphFilename !== undefined
      ? {
          readOnlyGraph: graphSource(
            Array.isArray(readOnlyGraphFilename)
              ? readOnlyGraphFilename
              : [readOnlyGraphFilename as string],
          ),
        }
      : {}),
  };
};
