// `@shapething/shacl-everything/tools` - the SHACL-driven code-gen / conversion tools, as a
// separate entry point so the main `.` entry (the React renderer) never pulls in their extra
// dependencies (notably @faker-js/faker, used only by generate).
export { generate, type GenerateOptions } from "@/outputs/generate.ts";
export { jsToRdf, type JsToRdfOptions } from "@/outputs/js-to-rdf.ts";
export { rdfToJs, type RdfToJsOptions } from "@/outputs/rdf-to-js.ts";
export { shaclToType, type TypeOptions as ShaclToTypeOptions } from "@/outputs/shacl-to-type.ts";
