import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Engine as ShaclEngine, type ValidateResult } from "shacl-engine";
import {
  constraints as sparqlConstraints,
  functions as sparqlFunctions,
} from "shacl-engine/sparql.js";
import { factory } from "@/helpers/factory.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { shapesGraphWithoutDynamicIn } from "@/structure/shapesGraphWithoutDynamicIn.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { validateDynamicInProperties } from "@/outputs/render/contexts/validateDynamicInProperties.ts";
import {
  createValidationStore,
  validationContext,
  type ValidationResult,
  type ValidationStore,
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

type Props = {
  children: ReactNode;
  // Written on every revalidation, alongside (not instead of) the store below - lets
  // EditModeWrapper read the current results at submit time to decide whether to block submission,
  // without subscribing to them as state itself: EditModeWrapper renders this provider as its own
  // child, so re-rendering *it* on every validation pass would remount every widget mid-edit (see
  // EditModeWrapper's own comment on why hasAttemptedSubmit is kept out of validationContext).
  latestResultsRef?: RefObject<ValidationResult[]>;
};

/**
 * Revalidates `dataGraph` against `shapesGraph` (scoped to `focusNode`/`nodeShapes`, the entity
 * this edit session actually renders - see NodeUIComponent) once on mount, then again on every
 * `dataGraph` write, debounced the same way as useInstanceSearch's own search-as-you-type. Exposes
 * the flattened results, indexed per property (see validationIndex.ts), through a subscribable
 * store in validationContext - so a run only re-renders the properties whose own results changed
 * (see usePropertyValidationResults), never this provider or the whole tree. shacl-engine validates nested sh:property/sh:node shapes as part of validating their
 * parent node shape, so scoping to just `nodeShapes` here still covers the whole edited subtree.
 */
export default function ValidationContextProvider({ children, latestResultsRef }: Props) {
  const { shapesGraph, dataGraph, focusNode, nodeShapes, corsProxyUrl } = useEnvironment();
  const storeRef = useRef<ValidationStore | null>(null);
  storeRef.current ??= createValidationStore();
  const store = storeRef.current;

  // shapesGraph is read-only for the lifetime of an Environment (see preprocess/index.ts), so a
  // single Validator compiled from it up front stays valid for every subsequent revalidation -
  // same one-engine-per-shapesGraph reasoning as score.ts's own getShaclEngine/shaclEngineCache.
  // Built from shapesGraphWithoutDynamicIn's filtered copy, not the raw shapesGraph, so a dynamic
  // sh:in [ sh:select ] is never evaluated here - that would pull its entire (possibly enormous)
  // remote baseline set just to check one value's membership; validateDynamicInProperties below
  // checks those properties itself instead, scoped to just their own current value(s).
  const engineRef = useRef<ShaclEngine | null>(null);
  engineRef.current ??= new ShaclEngine(shapesGraphWithoutDynamicIn(shapesGraph).asDataset(), {
    factory,
    functions: sparqlFunctions,
    constraints: sparqlConstraints,
  });

  // Federated dynamic sh:in results, reused across revalidations - see validateDynamicInProperties.
  const dynamicInCacheRef = useRef(new Map<string, Promise<Set<string>>>());

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Each run is independent async work, so a slow earlier run (e.g. a federated sh:in query)
    // can finish after a newer one - only the most recently started run may publish its results,
    // or stale results would overwrite fresh ones.
    let latestRun = 0;

    const runValidation = async () => {
      const run = ++latestRun;
      const isCurrent = () => !cancelled && run === latestRun;
      store.setIsValidating(true);
      try {
        const report = await engineRef.current!.validate(
          { dataset: dataGraph.asDataset(), terms: [focusNode] },
          nodeShapes.map((nodeShape) => ({ terms: [nodeShape] })),
        );
        const dynamicInResults = await validateDynamicInProperties(
          shapesGraph,
          dataGraph,
          nodeShapes,
          focusNode,
          corsProxyUrl,
          dynamicInCacheRef.current,
        );
        if (isCurrent()) {
          const combined = [...flattenResults(report.results), ...dynamicInResults];
          store.setResults(combined);
          if (latestResultsRef) latestResultsRef.current = combined;
        }
      } catch (error) {
        // The engine is constructed with shacl-engine/sparql.js's functions/constraints (see the
        // shacl-engine patch swapping its Comunica dependency for real SERVICE support), so e.g. a
        // dynamic sh:sparql/sh:expression constraint is genuinely evaluated rather than crashing
        // (a dynamic sh:in [ sh:select ] specifically never reaches this engine at all - see
        // shapesGraphWithoutDynamicIn/validateDynamicInProperties above). This stays defensive for
        // real failures instead (e.g. an unreachable SERVICE endpoint) - failing the whole
        // live-validation pass for one bad property would otherwise take down the validation UI for
        // every other, perfectly valid property on the same node. Leaves the results as whatever the
        // last successful run produced rather than clearing it, since a crashed run has no actual
        // conformance information to report.
        console.warn("[shacl-everything] SHACL validation failed:", error);
      } finally {
        if (isCurrent()) store.setIsValidating(false);
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
  }, [shapesGraph, dataGraph, focusNode, nodeShapes, corsProxyUrl, store]);

  return (
    <validationContext.Provider value={store}>{children}</validationContext.Provider>
  );
}
