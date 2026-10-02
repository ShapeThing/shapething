import React, {
  Suspense,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RdfStore } from "rdf-stores";
import { Loading } from "@/helpers/icons.tsx";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { Environment, RawEnvironment } from "@/environment.ts";
import { defaultEnvironment } from "@/environment.ts";
import {
  runPreprocessors,
  runPreprocessorsDeduped,
  defaultPreprocessors,
  type Preprocessor,
} from "@/preprocess/index.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { environmentContext } from "@/outputs/render/contexts/environmentContext.tsx";
import ContentLanguageProvider from "@/outputs/render/contexts/ContentLanguageProvider.tsx";
import { Localized } from "@fluent/react";
import { noRefetch } from "@/helpers/noRefetch.ts";
import type { LiveProps } from "@/outputs/render/environmentProps.ts";
import "./style.css";

type Props = Partial<RawEnvironment> & {
  preprocessors?: readonly Preprocessor[];
  children: React.ReactNode;
  instanceId: string;
  // Merged over the preprocessed Environment on every render - see environmentProps.ts. Identity
  // props are only read once per mount: ShaclRenderer remounts this provider (via `key`) when one
  // changes, since dataGraph becomes a live store widgets edit in place. The one exception is a
  // reactive shapesGraph (see reactiveRdfStore.ts) written to in place: the same store, so no
  // remount, but every write re-preprocesses - see PreprocessedEnvironmentProvider.
  liveProps?: LiveProps;
};

export default function EnvironmentContextProvider({
  children,
  preprocessors,
  instanceId,
  liveProps,
  ...props
}: Props) {
  const steps = preprocessors ?? defaultPreprocessors;
  const initialEnvironment = useMemo<RawEnvironment>(
    () => ({ ...defaultEnvironment, ...props }) as RawEnvironment,
    [],
  );

  const run = (keepDataGraph?: RdfStore): Promise<Environment> =>
    keepDataGraph
      ? runPreprocessors(initialEnvironment, steps, { keepDataGraph })
      : runPreprocessorsDeduped(initialEnvironment, steps);

  return (
    <Suspense
      fallback={
        <div className="st-environment-context-provider__loading">
          <Localized id="loading" />
          <Loading />
        </div>
      }
    >
      <PreprocessedEnvironmentProvider
        id={instanceId}
        run={run}
        shapesGraph={initialEnvironment.shapesGraph}
        liveProps={liveProps}
      >
        {children}
      </PreprocessedEnvironmentProvider>
    </Suspense>
  );
}

// Everything in a renderer's query cache is derived from its Environment's shapes (widget picks,
// active branches, option lookups, ...) except these - they're either the Environment itself or
// don't depend on it.
const SHAPE_INDEPENDENT_QUERIES = new Set([
  "preprocess-environment",
  "l10n-bundles",
  "iconify-search",
  "address-search",
  "lov-term-search",
]);

// How long a burst of shapesGraph writes (one gesture on the renderer editing that store is often
// several quads) is coalesced into one re-preprocessing pass.
const SHAPES_WRITE_DEBOUNCE_MS = 100;

/**
 * Preprocesses the Environment once per mount - and, when shapesGraph is a reactive store, again
 * after every write to it. The rest of the renderer treats shapesGraph as read-only for an
 * Environment's lifetime (structure/memo.ts, scoring's and validation's WeakMaps are all keyed on
 * its identity), so a shapes write isn't tracked per component: it yields a whole new
 * Environment, whose freshly resolved shapesGraph invalidates each of those caches by itself. The
 * tree stays mounted and reconciles by elementKey.ts's keys, and the live dataGraph - with its
 * edits, subscriptions and undo history - is carried over as-is.
 *
 * The re-run happens in a transition, so this already-revealed Suspense boundary keeps showing the
 * previous Environment until the new one has resolved, instead of falling back to "Loading".
 */
function PreprocessedEnvironmentProvider({
  id,
  children,
  run,
  shapesGraph,
  liveProps,
}: {
  id: string;
  children: React.ReactNode;
  run: (keepDataGraph?: RdfStore) => Promise<Environment>;
  shapesGraph: RawEnvironment["shapesGraph"];
  liveProps?: LiveProps;
}) {
  const queryClient = useQueryClient();
  const [shapesRevision, setShapesRevision] = useState(0);
  const currentRef = useRef<Environment>(undefined);

  useEffect(() => {
    const reactivity = shapesGraph instanceof RdfStore ? getReactivity(shapesGraph) : undefined;
    if (!reactivity) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const wildcard = { subject: null, predicate: null, object: null, graph: null };
    const unsubscribe = reactivity.subscribe([wildcard], () => {
      clearTimeout(timeout);
      timeout = setTimeout(
        () => startTransition(() => setShapesRevision((revision) => revision + 1)),
        SHAPES_WRITE_DEBOUNCE_MS,
      );
    });
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [shapesGraph]);

  const { data: preprocessed } = useSuspenseQuery({
    queryKey: ["preprocess-environment", id, shapesRevision],
    ...noRefetch,
    queryFn: async () => {
      const current = currentRef.current;
      if (!current) return run();
      try {
        return await run(current.dataGraph);
      } catch (error) {
        // A shape half-way through being edited may not preprocess (yet) - keep showing the last
        // one that did rather than replacing the whole form with an error.
        console.warn("[shacl-renderer] Re-preprocessing the changed shapesGraph failed:", error);
        return current;
      }
    },
  });

  // Once the tree has rendered with the new Environment (children's effects - and with them their
  // queries' latest options - run before this one), refresh everything derived from the previous
  // shapes: refetched in the background while still showing the old result where mounted, dropped
  // where not (noRefetch's refetchOnMount: false would otherwise hand a later mount the stale one).
  useEffect(() => {
    const previous = currentRef.current;
    currentRef.current = preprocessed;
    if (!previous || previous === preprocessed) return;
    const predicate = ({ queryKey }: { queryKey: readonly unknown[] }) =>
      !SHAPE_INDEPENDENT_QUERIES.has(queryKey[0] as string);
    queryClient.removeQueries({ predicate, type: "inactive" });
    queryClient.invalidateQueries({ predicate, refetchType: "active" });
    queryClient.removeQueries({
      queryKey: ["preprocess-environment", id],
      predicate: ({ queryKey }) => queryKey[2] !== shapesRevision,
    });
  }, [preprocessed, queryClient, id, shapesRevision]);

  const environment = useMemo(
    () => (liveProps ? { ...preprocessed, ...liveProps } : preprocessed),
    [preprocessed, liveProps],
  );

  return (
    <environmentContext.Provider value={environment}>
      <ContentLanguageProvider>{children}</ContentLanguageProvider>
    </environmentContext.Provider>
  );
}
