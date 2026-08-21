import { useId, useState, type KeyboardEvent } from "react";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { canonicalizeBCP47 } from "@/helpers/parseBCP47.ts";
import { languageLabels } from "@/helpers/languageLabels.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import { Localized } from "@fluent/react";
import "./style.css";

type Props = {
  open: boolean;
  onClose: () => void;
  // Languages already offered where this modal is opened from (e.g. ContentLanguageSwitcher's
  // global list, or a single value's own language options) - used to reject a duplicate and to
  // preview a newly typed tag alongside them.
  languages: BCP47[];
  onAdd: (language: BCP47) => void;
};

// Shared by ContentLanguageSwitcher (the global content language picker) and ValueLanguageSelect
// (a single value's own inline language picker) - both let someone type a BCP47 tag rather than
// pick from a fixed list, so the validate/canonicalize/preview/duplicate-check logic lives here
// once instead of twice.
export default function CreateLanguageModal({ open, onClose, languages, onAdd }: Props) {
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

  const submit = () => {
    if (!canonical) {
      setError("invalid");
      return;
    }
    if (languages.some((language) => language.toLowerCase() === canonical.toLowerCase())) {
      setError("duplicate");
      return;
    }
    onAdd(canonical);
    close();
  };

  // A plain <div>, not a <form> - this dialog renders wherever it's opened from (see Modal),
  // which for both ContentLanguageSwitcher and ValueLanguageSelect is inside the page's own edit
  // <form>. A real nested <form> is invalid HTML, and in practice makes the browser mishandle
  // which form a submit resolves to (up to and including navigating the page instead of running
  // this one's own logic) - Enter-to-submit is wired by hand below instead of relying on native
  // form submission.
  const onInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") submit();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={<Localized id="content-language-create-title">Add content language</Localized>}
    >
      <div className="st-create-language-modal">
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
            onKeyDown={onInputKeyDown}
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
          <button type="button" className="st-button" onClick={submit}>
            <Localized id="content-language-create-submit">Add</Localized>
          </button>
        </div>
      </div>
    </Modal>
  );
}
