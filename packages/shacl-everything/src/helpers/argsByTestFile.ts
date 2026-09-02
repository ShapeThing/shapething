import { factory } from "@/helpers/factory.ts";

// readOnlyGraphFilename is a second, separate fixture file (see Environment.readOnlyGraph) -
// not another fragment of `filename` - since it's read as its own graph rather than merged into
// shapesGraph/dataGraph. It should reference the same focus node as `filename`'s `<#data>` via a
// relative IRI (e.g. `<foo.ttl#data>`, not `<#data>`), since `<#data>` inside the read-only file
// would instead resolve against that file's own URL.
export const argsByTestFile = (filename: string, cwd: string, readOnlyGraphFilename?: string) => {
  return {
    shapesGraph: new URL(filename, cwd),
    nodeShapes: [factory.namedNode(new URL(`${filename}#shape`, cwd).href)],
    dataGraph: new URL(filename, cwd),
    focusNode: factory.namedNode(new URL(`${filename}#data`, cwd).href),
    ...(readOnlyGraphFilename !== undefined
      ? { readOnlyGraph: new URL(readOnlyGraphFilename, cwd) }
      : {}),
  };
};
