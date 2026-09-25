import type { ReactNode } from "react";
import { Localized } from "@fluent/react";
import { ErrorBoundary, getErrorMessage } from "react-error-boundary";
import "./style.css";

/**
 * Wraps one rendered widget so a widget that throws while rendering (a bug in it, a malformed
 * value it didn't expect, a lazy chunk failing to load) replaces only itself with a small inline
 * error - without this, the nearest boundary is ShaclRenderer's own root one, and the whole form
 * unmounts. `resetKeys` should change whenever the thing the widget renders does (its value, which
 * widget renders it), so picking another widget via WidgetSwitcher, or the value changing, gets a
 * fresh attempt instead of staying stuck on the error.
 */
export default function WidgetErrorBoundary({
  children,
  resetKeys,
  widget,
}: {
  children: ReactNode;
  resetKeys: unknown[];
  // The failing widget's IRI, for the console report only.
  widget?: string;
}) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      onError={(error) => console.error(`[shacl-everything] widget ${widget ?? ""} failed:`, error)}
      fallbackRender={({ error }) => (
        // Focusable, so edit mode's WidgetSlot fly-out (which opens on focus within the slot) stays
        // reachable - WidgetSwitcher is the user's way out of a broken widget.
        <div
          className="st-widget-error"
          role="alert"
          tabIndex={0}
          title={getErrorMessage(error) ?? undefined}
        >
          <Localized id="widget-render-error">This field could not be displayed.</Localized>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
