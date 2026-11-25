/// <reference types="vite-plus/client" />
/// <reference types="unplugin-icons/types/react" />

interface ImportMetaEnv {
  // Set by .storybook/sparqlCopyPage.ts on the dev server only - see logFacetQuery.
  readonly SPARQL_COPY_PAGE?: string;
}

// See build/ttlQuadsPlugin.ts.
declare module "*.ttl?quads" {
  const graph: import("@/helpers/quadTuples.ts").EncodedQuads;
  export default graph;
}

// rdf-validation ships no types - only the one class scoring/helpers.ts uses (the very same check
// shacl-engine's sh:datatype runs).
declare module "rdf-validation" {
  export class XsdValidation {
    validateSimple(term: import("@rdfjs/types").Literal): boolean;
  }
}
