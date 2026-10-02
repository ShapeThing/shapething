import Modal from "@/outputs/render/components/Modal/index.tsx";
import { Localized } from "@fluent/react";

type Props = {
  // The language about to be deleted, and its display label - `undefined` while closed, rather
  // than a separate boolean, so there's never a render where the modal is open but has nothing to
  // name in its confirmation message.
  language: string | undefined;
  label: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
};

// Confirms before deleteLiteralsByLanguage (see ContentLanguageSwitcher) wipes every value in a
// language - that helper is irreversible within the session (there's no undo), so unlike
// CreateLanguageModal this always needs an explicit "are you sure" step first.
export default function DeleteLanguageModal({ language, label, onCancel, onConfirm }: Props) {
  return (
    <Modal
      open={language !== undefined}
      onClose={onCancel}
      title={<Localized id="content-language-delete-title">Delete language content</Localized>}
    >
      <div className="st-delete-language-modal">
        <p>
          <Localized id="content-language-delete-message" vars={{ language: label ?? "" }}>
            {`Delete every value in ${label}? This removes them from the data entirely and cannot be undone.`}
          </Localized>
        </p>
        <div className="st-delete-language-modal__actions">
          <button type="button" className="st-button st-button--text" onClick={onCancel}>
            <Localized id="content-language-delete-cancel">Cancel</Localized>
          </button>
          <button type="button" className="st-button st-button--danger" onClick={onConfirm}>
            <Localized id="content-language-delete-confirm">Delete</Localized>
          </button>
        </div>
      </div>
    </Modal>
  );
}
