import { useIsFetching } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { Loading } from "@/helpers/icons.tsx";
import {
  settleGateContext,
  useRegisterPending,
} from "@/outputs/render/contexts/loadingIndicatorContext.tsx";

/**
 * The indicator of a closed gate. Unlike a LoadingFallback it ignores the `loadingIndicator` prop
 * when that is `null`: the form is invisible, so the indicator is all there is to see. It is outside
 * its own gate's provider, so it registers with an outer gate (a nested renderer) as pending.
 */
function SettleIndicator({ children }: { children: React.ReactNode }) {
  useRegisterPending();
  return <>{children ?? <Loading />}</>;
}

// How long nothing may be fetching or suspended before the gate opens. A resolved query often
// mounts a child whose own query only starts in the next commit, so "nothing pending" has to hold
// for a moment rather than a single check.
const QUIET_WINDOW = 50;

/**
 * Holds the first paint of the form until it has settled: no query of this renderer's QueryClient
 * fetching and no Suspense fallback mounted below, for QUIET_WINDOW ms - or until `timeout` ms
 * passed, whichever comes first. Until then the tree renders (so its queries run and its layout
 * exists, e.g. for a map measuring its container) but stays invisible and inert behind one loading
 * indicator, instead of showing labels first and values popping in one by one afterwards.
 *
 * Only the initial load is gated: once open, the gate stays open, so later fetches (a value
 * changed, a branch switched) behave as they always did. A nested renderer has its own gate; its
 * loading indicator is a LoadingFallback outside its own provider, so the outer gate waits for it.
 */
export function SettleGate({
  timeout,
  indicator,
  children,
}: {
  timeout: number;
  /** What shows while the gate is closed; undefined (or null) for the built-in spinner. */
  indicator: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(timeout <= 0);
  const [pending, setPending] = useState(0);
  const fetching = useIsFetching();

  const gate = useMemo(
    () => ({
      register: () => {
        setPending((count) => count + 1);
        return () => setPending((count) => count - 1);
      },
    }),
    [],
  );

  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setOpen(true), timeout);
    return () => clearTimeout(timer);
  }, [open, timeout]);

  useEffect(() => {
    if (open || fetching > 0 || pending > 0) return;
    const timer = setTimeout(() => setOpen(true), QUIET_WINDOW);
    return () => clearTimeout(timer);
  }, [open, fetching, pending]);

  // The same two elements in both states (only their styles change), so opening never remounts
  // the form.
  return (
    <div
      className="st-settle-gate"
      style={open ? { display: "contents" } : { position: "relative" }}
      aria-busy={open ? undefined : true}
    >
      {!open && (
        <div className="st-settle-gate__indicator">
          <SettleIndicator>{indicator}</SettleIndicator>
        </div>
      )}
      <div
        className="st-settle-gate__content"
        style={open ? { display: "contents" } : { visibility: "hidden" }}
        aria-hidden={open ? undefined : true}
        inert={!open}
      >
        <settleGateContext.Provider value={open ? undefined : gate}>
          {children}
        </settleGateContext.Provider>
      </div>
    </div>
  );
}
