declare module "shacl-engine" {
  import type { DataFactory, DatasetCore, Literal, Term } from "@rdfjs/types";

  type ValidateData = {
    dataset: DatasetCore;
    // A missing/undefined term means "no specific focus node" - the validator falls back to
    // resolving every shape's own sh:target* declarations instead (see Engine.js's validate()).
    terms?: (Term | undefined)[];
  };

  type ShapeRef = {
    terms: Term[];
  };

  // A grapoi pointer, as returned by shacl-engine for Result#focusNode/#value and
  // Result#shape.ptr - shacl-engine depends on grapoi internally, but this package doesn't, so
  // this only declares the minimal structural surface actually used (.term/.terms), matching this
  // file's existing convention of hand-rolling just what's needed rather than pulling in
  // shacl-engine's transitive deps.
  type Pointer = {
    term: Term;
    terms: Term[];
  };

  // See node_modules/shacl-engine's lib/validation/Result.js - no published types exist for this
  // package. Exported so callers (e.g. ValidationContextProvider) can type the raw
  // `report.results` they read off Engine#validate's return value.
  export type ValidateResult = {
    focusNode: Pointer;
    // The specific offending value, when the violated constraint concerns one (e.g.
    // sh:pattern/sh:datatype) - absent for property-wide constraints like sh:minCount.
    value?: Pointer;
    shape: { ptr: Pointer };
    severity: Term;
    message: Literal[];
  };

  type ValidateReport = {
    conforms: boolean;
    results: ValidateResult[];
  };

  // What lib/features/sparql/{functions,constraints}.js (re-exported as "shacl-engine/sparql.js")
  // actually export - TermMaps keyed by predicate, merged into the Engine's own registries. Kept
  // structural/untyped rather than pulling in shacl-engine's internal FunctionContext type, same
  // "hand-roll only what's used" reasoning as Pointer above.
  type FunctionMap = Iterable<[Term, unknown]>;

  export class Engine {
    constructor(
      shapes: DatasetCore,
      options?: { factory?: DataFactory; functions?: FunctionMap; constraints?: FunctionMap },
    );
    validate(data: ValidateData, shapes?: ShapeRef[]): Promise<ValidateReport>;
  }
}

// The opt-in Comunica-backed sh:select/sh:sparqlExpr/sh:sparql feature (see the shacl-engine patch
// swapping its Comunica dependency to @comunica/query-sparql for real SERVICE support) - not part
// of the package's main entry, so it needs its own module declaration.
declare module "shacl-engine/sparql.js" {
  import type { Term } from "@rdfjs/types";

  type FunctionMap = Iterable<[Term, unknown]>;

  export const functions: FunctionMap;
  export const constraints: FunctionMap;
}
