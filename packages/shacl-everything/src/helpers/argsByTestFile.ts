import { factory } from "@/helpers/factory.ts";
import type { RdfSource } from "@/types/RdfSource.ts";

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
  const toUrls = (names: readonly string[]) => names.map((name) => new URL(name, cwd));
  const graphSource = (names: readonly string[]): RdfSource => {
    const urls = toUrls(names);
    return urls.length === 1 ? urls[0] : urls;
  };

  return {
    shapesGraph: graphSource(filenames),
    nodeShapes: [factory.namedNode(new URL(`${primaryFilename}#shape`, cwd).href)],
    dataGraph: graphSource(filenames),
    focusNode: factory.namedNode(new URL(`${primaryFilename}#data`, cwd).href),
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
