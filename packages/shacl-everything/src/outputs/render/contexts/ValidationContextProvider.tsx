import { useEffect, useRef, useState, type ReactNode } from "react";
import { Engine as ShaclEngine, type ValidateResult } from "shacl-engine";
import {
  constraints as sparqlConstraints,
  functions as sparqlFunctions,
} from "shacl-engine/sparql.js";
import { factory } from "@/helpers/factory.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import {
  validationContext,
  type ValidationResult,
} from "@/outputs/render/contexts/validationContext.tsx";

const VALIDATION_DEBOUNCE_MS = 200;

function flattenResults(results: ValidateResult[]): ValidationResult[] {
  return results.map((result) => ({
    focusNode: result.focusNode.term,
    sourceShape: result.shape.ptr.term,
    value: result.value?.term,
    severity: result.severity,
    message: result.message,
  }));
}

/**
 * Revalidates `dataGraph` against `shapesGraph` (scoped to `focusNode`/`nodeShapes`, the entity
 * this edit session actually renders - see NodeUIComponent) once on mount, then again on every
 * `dataGraph` write, debounced the same way as useInstanceSearch's own search-as-you-type. Exposes
 * the flattened result list via validationContext for usePropertyValidationResults to filter per
 * property. shacl-engine validates nested sh:property/sh:node shapes as part of validating their
 * parent node shape, so scoping to just `nodeShapes` here still covers the whole edited subtree.
 */
export default function ValidationContextProvider({ children }: { children: ReactNode }) {
  const { shapesGraph, dataGraph, focusNode, nodeShapes } = useEnvironment();
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(true);

  // shapesGraph is read-only for the lifetime of an Environment (see preprocess/index.ts), so a
  // single Validator compiled from it up front stays valid for every subsequent revalidation -
  // same one-engine-per-shapesGraph reasoning as score.ts's own getShaclEngine/shaclEngineCache.
  const engineRef = useRef<ShaclEngine | null>(null);
  engineRef.current ??= new ShaclEngine(shapesGraph.asDataset(), {
    factory,
    functions: sparqlFunctions,
    constraints: sparqlConstraints,
  });

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const runValidation = async () => {
      setIsValidating(true);
      try {
        const report = await engineRef.current!.validate(
          { dataset: dataGraph.asDataset(), terms: [focusNode] },
          nodeShapes.map((nodeShape) => ({ terms: [nodeShape] })),
        );
        if (!cancelled) setResults(flattenResults(report.results));
      } catch (error) {
        // The engine is constructed with shacl-engine/sparql.js's functions/constraints (see the
        // shacl-engine patch swapping its Comunica dependency for real SERVICE support), so a
        // dynamic sh:in [ sh:select "..." ] is genuinely evaluated rather than crashing. This stays
        // defensive for real failures instead (e.g. an unreachable SERVICE endpoint) - failing the
        // whole live-validation pass for one bad property would otherwise take down the validation
        // UI for every other, perfectly valid property on the same node. Leaves `results` as
        // whatever the last successful run produced rather than clearing it, since a crashed run
        // has no actual conformance information to report.
        console.warn("[shacl-everything] SHACL validation failed:", error);
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    };

    runValidation();

    const unsubscribe = getReactivity(dataGraph)?.subscribe(
      [{ subject: null, predicate: null, object: null, graph: null }],
      () => {
        clearTimeout(timeout);
        timeout = setTimeout(runValidation, VALIDATION_DEBOUNCE_MS);
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [dataGraph, focusNode, nodeShapes]);

  return (
    <validationContext.Provider value={{ results, isValidating }}>
      {children}
    </validationContext.Provider>
  );
}
