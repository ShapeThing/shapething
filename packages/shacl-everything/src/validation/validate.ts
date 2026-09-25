import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { Engine as ShaclEngine } from "shacl-engine";
import { factory } from "@/helpers/factory.ts";

// The generic "does this one focus node conform to this one shape" SHACL entry point, shared by
// every layer that needs a yes/no answer (widget scoring's matchers, structure/'s sh:or/sh:xone
// branch detection, resolution/targets.ts's sh:targetWhere check). Lives in its own neutral module
// - rather than in scoring/score.ts, where it started - so none of those layers has to import the
// scoring system (or each other) just to run a validation.

export type ValidateProps = {
  focusNode?: Term;
  targetGraph: RdfStore;
  shapeNode: Term;
  shapesGraph: RdfStore;
};

// Compiling a ShaclEngine parses every shape in shapesGraph up front (see shacl-engine's
// Engine constructor), which is wasted work when repeated for the same shapesGraph - as
// happens in scoring, since a matcher always validates against the same scoringGraph, once or
// twice per candidate widget. Keyed by object identity (every graph passed here is a stable
// instance for its Environment's lifetime), so this never serves a stale engine for a graph
// that's actually changed.
const shaclEngineCache = new WeakMap<RdfStore, ShaclEngine>();

export function getShaclEngine(shapesGraph: RdfStore): ShaclEngine {
  let shaclEngine = shaclEngineCache.get(shapesGraph);
  if (!shaclEngine) {
    shaclEngine = new ShaclEngine(shapesGraph.asDataset(), { factory });
    shaclEngineCache.set(shapesGraph, shaclEngine);
  }
  return shaclEngine;
}

export async function validate(
  { focusNode, targetGraph, shapeNode, shapesGraph }: ValidateProps,
): Promise<boolean> {
  if (!shapeNode) return true;

  const dataset = targetGraph.size > 0
    ? targetGraph.asDataset()
    : shapesGraph.asDataset();

  const shaclEngine = getShaclEngine(shapesGraph);
  try {
    const report = await shaclEngine.validate(
      {
        dataset,
        terms: [focusNode],
      },
      [{ terms: [shapeNode] }],
    );
    return report.conforms;
  } catch (error) {
    console.warn(
      `SHACL validation failed for shape ${shapeNode.value}:`,
      error,
    );
    return false;
  }
}
