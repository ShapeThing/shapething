// `@shapething/shacl-renderer/astro` - an Astro content loader built on the conversion tools, as a
// separate, Node-only entry point (it reads files from disk) so neither the renderer nor `/tools`
// pull in node: builtins.
export { astroLoader, type AstroLoaderOptions } from "@/outputs/astro-loader.ts";
