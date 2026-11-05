import type { DatasetCore, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { st } from "@/helpers/namespaces.ts";

// st:dirty - a ShapeThing constraint for edit mode, plugged into shacl-engine's own constraint
// registry (Engine's `constraints` option, the same hook shacl-engine/sparql.js uses for
// sh:sparql). `st:dirty true` conforms only while the data graph differs from the one the edit
// session started with, `st:dirty false` only while it doesn't - e.g. `st:dirty true` blocks
// submitting an unchanged form. "Changed" is graph-wide, not scoped to the shape's own focus
// node or path: an undo back to the original data makes the graph clean again.

export const DirtyConstraintComponent = st("DirtyConstraintComponent");

/** Whether `dataset` differs from the data graph the edit session started with. */
export type IsDirty = (dataset: DatasetCore) => boolean;

/**
 * An IsDirty comparing against a fixed `baseline` (see helpers/snapshotStore.ts): a dataset is
 * clean when it holds exactly the baseline's quads - same size, and every baseline quad present.
 * Not memoized per dataset: an RdfStore's asDataset() is a live view, so the same object can hold
 * different quads later.
 */
export function isDirtyComparedTo(baseline: RdfStore): IsDirty {
  return (dataset) => {
    if (dataset.size !== baseline.size) return true;
    for (const quad of baseline.readQuads()) if (!dataset.has(quad)) return true;
    return false;
  };
}

// xsd:boolean's two lexical forms for true.
const isTrue = (term: Term) =>
  term.termType === "Literal" && (term.value === "true" || term.value === "1");

// Structural stand-ins for the parts of shacl-engine's (untyped) Shape/ValidationShapeContext the
// validator touches - see types/shacl-engine.d.ts for the same hand-roll-only-what's-used reasoning.
type CompileShape = { ptr: { out: (predicates: Term[]) => { terms: Term[] } } };
type ValidationContext = {
  focusNode: { dataset: DatasetCore };
  factory: { literal: (value: string, language?: string) => Term };
  test: (success: boolean, constraintComponent: Term, args: object) => void;
};

/**
 * shacl-engine constraint entries for st:dirty, to merge into an Engine's `constraints` option.
 * Registered for node shapes (`node`, once per focus node) and property shapes (`values`, once per
 * focus node regardless of how many values the path reaches - the constraint is about the graph,
 * not about any one value).
 */
export function dirtyConstraints(isDirty: IsDirty): [Term, unknown][] {
  const compile = (shape: CompileShape) => {
    const expected = shape.ptr.out([st("dirty")]).terms;
    if (expected.length === 0) return undefined;
    const expectDirty = expected.some(isTrue);

    const validateDirty = (context: ValidationContext) => {
      const dirty = isDirty(context.focusNode.dataset);
      context.test(dirty === expectDirty, DirtyConstraintComponent, {
        args: { dirty: String(dirty) },
        message: [
          context.factory.literal(
            expectDirty ? "The data has not been changed" : "The data has been changed",
          ),
        ],
      });
    };

    return { node: validateDirty, values: validateDirty };
  };

  return [[st("dirty"), compile]];
}
