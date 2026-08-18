import { useId, useState, type FormEvent } from "react";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { canonicalizeBCP47 } from "@/helpers/parseBCP47.ts";
import { languageLabels } from "@/helpers/languageLabels.ts";
import { Localized } from "@fluent/react";
import "./style.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateLanguageModal({ open, onClose }: Props) {
  const { languages, addLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const [value, setValue] = useState("");
  const [error, setError] = useState<"invalid" | "duplicate">();
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  // A live preview of what the typed tag actually resolves to (e.g. "de-de" -> "German") - lets
  // someone confirm they typed the code they meant before submitting, rather than only finding out
  // afterwards from how it reads in the switcher. Folded in alongside the existing languages so a
  // tag that would collide on its base name (e.g. typing "en-US" while "en-GB" is already listed)
  // previews with the same disambiguating qualifier the switcher itself would show, not a bare
  // "English" that looks identical to one already in the list.
  const canonical = canonicalizeBCP47(value);
  const previewLabel = canonical
    ? languageLabels(
        languages.includes(canonical) ? languages : [...languages, canonical],
        activeInterfaceLanguage,
      )[canonical]
    : undefined;

  const close = () => {
    onClose();
    setValue("");
    setError(undefined);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
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
        <FormElement
          label={<Localized id="content-language-create-label">Language tag</Localized>}
          htmlFor={inputId}
        >
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
          {previewLabel && (
            <p className="st-create-language-modal__preview">
              <Localized id="content-language-create-preview" vars={{ label: previewLabel }}>
                {`Preview: ${previewLabel}`}
              </Localized>
            </p>
          )}
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
        </FormElement>
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
