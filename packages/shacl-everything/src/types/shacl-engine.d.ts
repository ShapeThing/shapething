declare module "shacl-engine" {
  import type { DataFactory, DatasetCore, Term } from "@rdfjs/types";

  type ValidateData = {
    dataset: DatasetCore;
    // A missing/undefined term means "no specific focus node" - the validator falls back to
    // resolving every shape's own sh:target* declarations instead (see Validator.js's validate()).
    terms?: (Term | undefined)[];
  };

  type ShapeRef = {
    terms: Term[];
  };

  type ValidateReport = {
    conforms: boolean;
  };

  export class Validator {
    constructor(shapes: DatasetCore, options?: { factory?: DataFactory });
    validate(data: ValidateData, shapes?: ShapeRef[]): Promise<ValidateReport>;
  }
}
