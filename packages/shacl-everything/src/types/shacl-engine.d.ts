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

  export class Engine {
    constructor(shapes: DatasetCore, options?: { factory?: DataFactory });
    validate(data: ValidateData, shapes?: ShapeRef[]): Promise<ValidateReport>;
  }
}
