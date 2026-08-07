import { useId, useState, type FormEvent } from "react";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { canonicalizeBCP47 } from "@/helpers/parseBCP47.ts";
import { Localized } from "@fluent/react";
import "./style.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateLanguageModal({ open, onClose }: Props) {
  const { languages, addLanguage } = useContentLanguage();
  const [value, setValue] = useState("");
  const [error, setError] = useState<"invalid" | "duplicate">();
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const close = () => {
    onClose();
    setValue("");
    setError(undefined);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const canonical = canonicalizeBCP47(value);
    if (!canonical) {
      setError("invalid");
      return;
    }
    if (languages.some((language) => language.toLowerCase() === canonical.toLowerCase())) {
      setError("duplicate");
      return;
    }
    addLanguage(canonical);
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={<Localized id="content-language-create-title">Add content language</Localized>}
    >
      <form className="st-create-language-modal" onSubmit={onSubmit}>
        <label className="st-label" htmlFor={inputId}>
          <Localized id="content-language-create-label">Language tag</Localized>
        </label>
        <input
          id={inputId}
          className="st-input"
          type="text"
          autoFocus
          autoComplete="off"
          placeholder="en-GB"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(undefined);
          }}
          aria-invalid={error !== undefined}
          aria-describedby={hintId}
        />
        <p id={hintId} className="st-create-language-modal__hint">
          <Localized id="content-language-create-hint" />
        </p>
        {error && (
          <p className="st-create-language-modal__error" role="alert">
            <Localized
              id={
                error === "invalid"
                  ? "content-language-create-error-invalid"
                  : "content-language-create-error-duplicate"
              }
            />
          </p>
        )}
        <div className="st-create-language-modal__actions">
          <button type="button" className="st-button st-button--text" onClick={close}>
            <Localized id="content-language-create-cancel">Cancel</Localized>
          </button>
          <button type="submit" className="st-button">
            <Localized id="content-language-create-submit">Add</Localized>
          </button>
        </div>
      </form>
    </Modal>
  );
}
