/// <reference types="vite-plus/client" />
/// <reference types="unplugin-icons/types/react" />

interface ImportMetaEnv {
  // Set by .storybook/sparqlCopyPage.ts on the dev server only - see logFacetQuery.
  readonly SPARQL_COPY_PAGE?: string;
}
