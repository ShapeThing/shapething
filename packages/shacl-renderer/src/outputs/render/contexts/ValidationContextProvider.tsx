import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Engine as ShaclEngine, type ValidateResult } from "shacl-engine";
import {
  constraints as sparqlConstraints,
  functions as sparqlFunctions,
} from "shacl-engine/sparql.js";
import { factory } from "@/helpers/factory.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { shapesGraphWithoutDynamicIn } from "@/structure/shapesGraphWithoutDynamicIn.ts";
import {
  federatedPropertyShapes,
  withoutUncheckableRemoteValueResults,
} from "@/structure/federatedPropertyShapes.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { validateDynamicInProperties } from "@/outputs/render/contexts/validateDynamicInProperties.ts";
import {
  createValidationStore,
  validationContext,
  type ValidationResult,
  type ValidationStore,
} from "@/outputs/render/contexts/validationContext.tsx";
import { dirtyConstraints, type IsDirty } from "@/validation/dirtyConstraint.ts";

const VALIDATION_DEBOUNCE_MS = 200;

function flattenResults(results: ValidateResult[]): ValidationResult[] {
  return results.map((result) => ({
    focusNode: result.focusNode.term,
    sourceShape: result.shape.ptr.term,
    value: result.value?.term,
    severity: result.severity,
    message: result.message,
    // Lets ResultMessages describe the result from the shape's own parameters ("Must be at least
    // 20") instead of the engine's technical default message.
    constraintComponent: result.constraintComponent,
    constraintShape: result.shape.ptr.term,
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
  // Set to a function that validates the data graph as it is right now - skipping the debounce -
  // and returns the results. Submitting awaits it: latestResultsRef can still hold the results of
  // before the last edit, as a run starts VALIDATION_DEBOUNCE_MS after a change and takes time
  // itself. A just-typed required value would then block the submit, or a just-cleared one let it
  // through.
  validateNowRef?: RefObject<(() => Promise<ValidationResult[]>) | undefined>;
  // Backs the st:dirty constraint (see validation/dirtyConstraint.ts): whether the data graph
  // differs from the one this edit session started with. Without it, st:dirty treats the data as
  // never changed. Read once, when the engine below is built - pass a stable function.
  isDirty?: IsDirty;
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
export default function ValidationContextProvider({
  children,
  latestResultsRef,
  validateNowRef,
  isDirty,
}: Props) {
  const { shapesGraph, dataGraph, focusNode, nodeShapes, corsProxyUrl } = useEnvironment();
  const [store] = useState<ValidationStore>(createValidationStore);

  // shapesGraph is read-only for the lifetime of an Environment (see preprocess/index.ts), so one
  // engine per shapesGraph - which keeps its compiled shapes (see the shacl-engine patch) - serves
  // every revalidation - same one-engine-per-shapesGraph reasoning as validate.ts's getShaclEngine.
  // A re-preprocess (e.g. a live shapesGraph edited) hands down a new shapesGraph without
  // remounting this provider, so the engine is rebuilt for it rather than kept from the first one.
  // Built from shapesGraphWithoutDynamicIn's filtered copy, not the raw shapesGraph, so a dynamic
  // sh:in [ sh:select ] is never evaluated here - that would pull its entire (possibly enormous)
  // remote baseline set just to check one value's membership; validateDynamicInProperties below
  // checks those properties itself instead, scoped to just their own current value(s).
  const engine = useMemo(
    () =>
      new ShaclEngine(shapesGraphWithoutDynamicIn(shapesGraph).asDataset(), {
        factory,
        functions: sparqlFunctions,
        constraints: [...sparqlConstraints, ...dirtyConstraints(isDirty ?? (() => false))],
      }),
    [shapesGraph, isDirty],
  );

  // Federated dynamic sh:in results, reused across revalidations - see validateDynamicInProperties.
  const dynamicInCacheRef = useRef(new Map<string, Promise<Set<string>>>());
  const federatedShapes = useMemo(() => federatedPropertyShapes(shapesGraph), [shapesGraph]);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Each run is independent async work, so a slow earlier run (e.g. a federated sh:in query)
    // can finish after a newer one - only the most recently started run may publish its results,
    // or stale results would overwrite fresh ones.
    let latestRun = 0;

    // Returns the results of this run, also when a newer run has started since (they are still
    // the results for the data as it was when this run began); undefined when the run failed.
    const runValidation = async (): Promise<ValidationResult[] | undefined> => {
      const run = ++latestRun;
      const isCurrent = () => !cancelled && run === latestRun;
      store.setIsValidating(true);
      try {
        const report = await engine.validate(
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
        const localResults = withoutUncheckableRemoteValueResults(
          report.results,
          federatedShapes,
          dataGraph,
        );
        const combined = [...flattenResults(localResults), ...dynamicInResults];
        if (isCurrent()) {
          store.setResults(combined);
          if (latestResultsRef) latestResultsRef.current = combined;
        }
        return combined;
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
        console.warn("[shacl-renderer] SHACL validation failed:", error);
        return undefined;
      } finally {
        if (isCurrent()) store.setIsValidating(false);
      }
    };

    runValidation();

    if (validateNowRef) {
      validateNowRef.current = async () => {
        // The pending debounced run would only validate the same data again.
        clearTimeout(timeout);
        return (await runValidation()) ?? latestResultsRef?.current ?? [];
      };
    }

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
      if (validateNowRef) validateNowRef.current = undefined;
    };
  }, [
    engine,
    federatedShapes,
    shapesGraph,
    dataGraph,
    focusNode,
    nodeShapes,
    corsProxyUrl,
    store,
    latestResultsRef,
    validateNowRef,
  ]);

  return <validationContext.Provider value={store}>{children}</validationContext.Provider>;
}
