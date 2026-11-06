import { useIsFetching } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  LoadingFallback,
  settleGateContext,
} from "@/outputs/render/contexts/loadingIndicatorContext.tsx";

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
export function SettleGate({ timeout, children }: { timeout: number; children: React.ReactNode }) {
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
          <LoadingFallback />
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
