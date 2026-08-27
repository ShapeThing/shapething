import { useEffect, useId, useRef, type ReactNode } from "react";
import { Close } from "@/helpers/icons.tsx";
import { Localized } from "@fluent/react";
import "./style.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
};

// A generic modal dialog built on the native <dialog> element - showModal()/close() bring focus
// trapping, Escape-to-close and a ::backdrop for free, so there's no need to hand-roll those.
export default function Modal({ open, onClose, title, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="st-modal"
      aria-labelledby={titleId}
      onClose={onClose}
      // Escape's native default action is to close the dialog immediately, then fire "close" -
      // by then `onClose` would run after the fact, too late for a caller that wants a chance to
      // block the close (e.g. to confirm discarding unsaved changes) the same way it already can
      // for the header button/backdrop below. Preventing "cancel" stops that default action, so
      // Escape instead funnels through the exact same pre-close `onClose` call as the other two.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click landing directly on the <dialog> element (rather than bubbling up from
      // .st-modal__content) is a click on its ::backdrop - the standard way to detect that,
      // since the backdrop pseudo-element isn't a reachable event target of its own.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="st-modal__content">
        <header className="st-modal__header">
          <h2 id={titleId} className="st-modal__title">
            {title}
          </h2>
          <Localized id="modal-close" attrs={{ "aria-label": true }}>
            <button type="button" className="st-icon-button" aria-label="Close" onClick={onClose}>
              <Close />
            </button>
          </Localized>
        </header>
        {children}
      </div>
    </dialog>
  );
}
