import { Localized } from "@fluent/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "@/helpers/icons.tsx";
import "./style.css";

// Read from the rendered form rather than from validationContext: what's on screen already
// accounts for everything that decides whether an error is shown at all (hasAttemptedSubmit's
// gating, a collapsed group or an inactive tab not rendering its fields, ...), and in the order
// the user sees it.
const MESSAGE_SELECTOR = '.st-validation-message[data-severity="Violation"]';
// A per-value message (see PropertyUIComponentObject) targets its own value row, so a property with
// two invalid values is two stops; a property-wide one (e.g. sh:minCount) targets the whole field.
const TARGET_SELECTOR = ".st-property-object, .st-form-element";
const CONTROL_SELECTOR = 'input:not([type="hidden"]), select, textarea, [contenteditable="true"]';
const FOCUSABLE_SELECTOR = `${CONTROL_SELECTOR}, button, [href], [tabindex]:not([tabindex="-1"])`;

function errorTargets(form: HTMLFormElement): HTMLElement[] {
  const targets = new Set<HTMLElement>();
  for (const message of form.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR)) {
    if (!message.checkVisibility()) continue;
    const target = message.closest<HTMLElement>(TARGET_SELECTOR);
    if (target) targets.add(target);
  }
  return [...targets];
}

function firstEnabled(target: HTMLElement, selector: string): HTMLElement | undefined {
  return [...target.querySelectorAll<HTMLElement>(selector)].find(
    (element) => !(element as HTMLInputElement).disabled && element.checkVisibility(),
  );
}

/**
 * Up/down buttons stepping focus to the previous/next field with an error, shown only while the
 * form shows any. "Next" is relative to whatever currently has focus in the form, so after the
 * user tabs or clicks somewhere the arrows carry on from there.
 */
export default function ErrorNavigator() {
  const ref = useRef<HTMLDivElement>(null);
  const lastTargetRef = useRef<HTMLElement | null>(null);
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHasErrors(errorTargets(form).length > 0));
    };
    const observer = new MutationObserver(update);
    observer.observe(form, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-severity", "open", "hidden"],
    });
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const go = useCallback((direction: 1 | -1) => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const targets = errorTargets(form);
    if (targets.length === 0) return;

    const active = document.activeElement;
    const reference =
      active instanceof HTMLElement && form.contains(active) && !ref.current!.contains(active)
        ? active
        : lastTargetRef.current?.isConnected
          ? lastTargetRef.current
          : null;

    let target: HTMLElement | undefined;
    if (!reference) {
      target = direction === 1 ? targets[0] : targets.at(-1);
    } else {
      // A target containing the reference is the one the user is already in - skipped both ways.
      const position = (candidate: HTMLElement) =>
        candidate === reference || candidate.contains(reference)
          ? 0
          : reference.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING
            ? 1
            : -1;
      target =
        direction === 1
          ? (targets.find((candidate) => position(candidate) === 1) ?? targets[0])
          : (targets.findLast((candidate) => position(candidate) === -1) ?? targets.at(-1));
    }
    if (!target) return;

    lastTargetRef.current = target;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    const focusable =
      firstEnabled(target, CONTROL_SELECTOR) ?? firstEnabled(target, FOCUSABLE_SELECTOR);
    focusable?.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={ref} className="st-error-navigator" hidden={!hasErrors}>
      <Localized id="error-navigator-previous" attrs={{ "aria-label": true, title: true }}>
        <button
          type="button"
          className="st-button st-button--severity severity-error"
          aria-label="Previous error"
          title="Previous error"
          onClick={() => go(-1)}
        >
          <ArrowUp />
        </button>
      </Localized>
      <Localized id="error-navigator-next" attrs={{ "aria-label": true, title: true }}>
        <button
          type="button"
          className="st-button st-button--severity severity-error"
          aria-label="Next error"
          title="Next error"
          onClick={() => go(1)}
        >
          <ArrowDown />
        </button>
      </Localized>
    </div>
  );
}
