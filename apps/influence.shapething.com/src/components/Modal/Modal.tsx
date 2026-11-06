import { type ReactNode, useEffect, useId, useRef } from "react";
import "./style.scss";

type Props = {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** The URL of a wide image across the top of the modal, above the title. */
  banner?: string;
};

/**
 * A modal dialog: the native <dialog>, so focus stays inside it and Escape closes it. Clicking the
 * backdrop closes it too. A banner image, when given, runs across the top, above the title.
 */
export default function Modal({ title, onClose, children, footer, banner }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // The dialog itself only receives the click outside its content: on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal__content">
        {banner && <img className="modal__banner" src={banner} alt="" />}
        <header className="modal__header">
          <h1 className="modal__title" id={titleId}>
            {title}
          </h1>
          <button type="button" className="modal__close" onClick={onClose}>
            <span className="visually-hidden">Close</span>
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
