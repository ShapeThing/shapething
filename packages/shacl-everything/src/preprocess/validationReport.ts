import { RdfStore } from "rdf-stores";
import type { RawEnvironment } from "@/environment.ts";
import { copyStore, parseValidationReport, resolveReport } from "@/validation/report.ts";

/**
 * Report mode only: matches Environment.validationReport's results onto shapesGraph (see
 * validation/report.ts's resolveReport) and stores the outcome as Environment.report.
 *
 * A report is largely self-contained against its shapes but not its data (SHACL 1.2 Core, 3.6):
 * sh:resultPath is a full copy of the original sh:path and sh:value the offending value, while
 * labels and everything else about a focus node live in the data graph. So:
 * - without shapes, each result renders under a property shape generated from its sh:resultPath;
 * - the report's own focus node -> path -> value triples are written into dataGraph, replacing
 *   the data's current values for those properties: the report is a snapshot of the data as it
 *   was validated, which may have changed since. Everything else (labels, the rest of a resource)
 *   still comes from the data.
 *
 * Runs right after resolveRdfSources, so the reconstructed values count towards the content
 * languages distillLanguages finds, and generated property shapes still get a dereferenced name
 * from dereferenceMissingPropertyNames when that's enabled. Both graphs are copied first rather
 * than written in place - either may be the caller's own RdfStore.
 */
export const resolveValidationReport = (raw: RawEnvironment): RawEnvironment => {
  if (raw.mode !== "report" || !(raw.validationReport instanceof RdfStore)) return raw;
  if (!(raw.shapesGraph instanceof RdfStore) || !(raw.dataGraph instanceof RdfStore)) return raw;

  const shapesGraph = copyStore(raw.shapesGraph);
  const dataGraph = copyStore(raw.dataGraph);
  const report = resolveReport(parseValidationReport(raw.validationReport), shapesGraph, dataGraph);

  return { ...raw, shapesGraph, dataGraph, report };
};
