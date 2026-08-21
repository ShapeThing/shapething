import { useEffect, useId, useMemo, useRef, useState } from "react";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import CreateLanguageModal from "@/outputs/render/components/ContentLanguageSwitcher/CreateLanguageModal.tsx";
import DeleteLanguageModal from "@/outputs/render/components/ContentLanguageSwitcher/DeleteLanguageModal.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import { deleteLiteralsByLanguage } from "@/helpers/deleteLiteralsByLanguage.ts";
import { Delete } from "@/helpers/icons.tsx";
import type { BCP47 } from "@/types/BCP47.ts";
import { Localized } from "@fluent/react";
import "./style.css";

export default function ContentLanguageSwitcher() {
  const { languageMode, enableContentLanguageCreation, enableFullLanguageRemoval, dataGraph } =
    useEnvironment();
  const { languages, activeLanguage, setActiveLanguage, removeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [languageToDelete, setLanguageToDelete] = useState<BCP47>();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();
  const triggerId = useId();

  // Content values are in all sorts of languages - but the picker naming them is chrome, so it
  // reads in whichever language the interface itself is currently in (unlike the interface
  // language switcher, which always shows autonyms - see languageLabels).
  const labels = useMemo(
    () => languageLabels(languages, activeInterfaceLanguage),
    [languages, activeInterfaceLanguage],
  );

  useEffect(() => {
    if (open && activeIndex >= 0)
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  // In "individual" mode every translation renders side by side, each with its own per-value
  // language <select> (see TextFieldWithLangEditor/TextAreaWithLangEditor) - there is nothing
  // for a single global switcher to pick between, and nowhere for a newly created language to be
  // shown either, so the whole thing (switcher and creation) stays hidden.
  const enabled = languageMode !== "individual";
  const showCreateOption = enabled && Boolean(enableContentLanguageCreation);
  // The dropdown is worth showing even with only one language, as long as it can grow via the
  // "add language" row below - otherwise there'd be nowhere to trigger creation from at all.
  const showSelect = enabled && (languages.length > 1 || showCreateOption);

  if (!showSelect) return null;

  // "Add language…" is an extra row after every real language, so keyboard navigation (which
  // knows nothing about what a row means) just treats it as one more index.
  const rowCount = languages.length + (showCreateOption ? 1 : 0);

  const close = () => setOpen(false);

  const selectLanguage = (language: BCP47) => {
    setActiveLanguage(language);
    close();
    triggerRef.current?.focus();
  };

  const openCreateModal = () => {
    setCreateModalOpen(true);
    close();
  };

  const activate = (index: number) => {
    if (index < languages.length) selectLanguage(languages[index]);
    else if (showCreateOption) openCreateModal();
  };

  return (
    <>
      <FormElement
        className="st-content-language-switcher"
        label={<Localized id="content-language-switcher-label">Content language</Localized>}
        tooltip={<Localized id="content-language-switcher-tooltip" />}
        htmlFor={triggerId}
      >
        <div
          className="st-content-language-switcher__wrapper"
          // A custom listbox rather than a native <select> - a native <option> can't hold an
          // interactive child, and each row here needs its own delete button (see
          // DeleteLanguageModal). Closes on any focus that leaves this wrapper entirely, e.g.
          // Tab away or a click landing outside it - relatedTarget is the element about to be
          // focused, so a null/outside value means focus is leaving for good.
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
          }}
        >
          <button
            ref={triggerRef}
            id={triggerId}
            type="button"
            className="st-select st-content-language-switcher__trigger"
            // A test/query hook: the button carries the picked language as text (in whichever
            // interface language is active - see labels above), which isn't a stable enough
            // handle for tests to assert on or select by, unlike a native <select>'s own `value`.
            data-active-language={activeLanguage}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={
              open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
            }
            onClick={() => {
              setActiveIndex(languages.indexOf(activeLanguage));
              setOpen((current) => !current);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (!open) {
                  setActiveIndex(languages.indexOf(activeLanguage));
                  setOpen(true);
                  return;
                }
                const delta = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((current) => (current + delta + rowCount) % rowCount);
              } else if (event.key === "Home" && open) {
                event.preventDefault();
                setActiveIndex(0);
              } else if (event.key === "End" && open) {
                event.preventDefault();
                setActiveIndex(rowCount - 1);
              } else if (event.key === "Escape") {
                close();
              } else if ((event.key === "Enter" || event.key === " ") && open) {
                event.preventDefault();
                if (activeIndex >= 0) activate(activeIndex);
              } else if (
                event.key === "Delete" &&
                open &&
                activeIndex >= 0 &&
                activeIndex < languages.length
              ) {
                // The per-row delete button (see below) is tabIndex={-1} - reachable by mouse
                // only, so keyboard use goes through the highlighted row instead, same as most
                // list UIs' Delete-key convention.
                event.preventDefault();
                setLanguageToDelete(languages[activeIndex]);
                close();
              }
            }}
          >
            {labels[activeLanguage] ?? activeLanguage}
          </button>
          <span className="st-select-arrow" aria-hidden="true" />

          {open && (
            <div id={listboxId} role="listbox" className="st-content-language-switcher__listbox">
              {languages.map((language, index) => (
                <div
                  key={language}
                  id={`${listboxId}-option-${index}`}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  role="option"
                  data-language={language}
                  aria-selected={language === activeLanguage}
                  className={
                    "st-content-language-switcher__option" +
                    (index === activeIndex ? " st-content-language-switcher__option--active" : "")
                  }
                  // Keeps focus on the trigger during the click so the wrapper's onBlur above
                  // never fires for it (a plain, non-focusable row would otherwise shift focus to
                  // <body> on mousedown and close the listbox before the click lands) - onClick
                  // still runs normally afterwards.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectLanguage(language)}
                >
                  <span className="st-content-language-switcher__option-label">
                    {labels[language]}
                  </span>
                  {enableFullLanguageRemoval && (
                    <Localized
                      id="content-language-delete-option"
                      vars={{ language: labels[language] ?? language }}
                      attrs={{ "aria-label": true }}
                    >
                      <button
                        type="button"
                        // Reachable by mouse only (see the trigger's Delete-key handling above) -
                        // a real focusable button nested inside a row would otherwise stop Tab
                        // here instead of leaving the listbox in one hop, breaking the roving,
                        // aria-activedescendant-driven focus model the rest of this listbox uses.
                        tabIndex={-1}
                        className="st-content-language-switcher__delete"
                        aria-label="Delete language content"
                        onClick={(event) => {
                          // Deleting is a distinct action from picking this row as the active
                          // language - stop it from also bubbling into the row's own onClick above.
                          event.stopPropagation();
                          setLanguageToDelete(language);
                          close();
                        }}
                      >
                        <Delete />
                      </button>
                    </Localized>
                  )}
                </div>
              ))}
              {showCreateOption && (
                <div
                  id={`${listboxId}-option-${languages.length}`}
                  ref={(el) => {
                    optionRefs.current[languages.length] = el;
                  }}
                  role="option"
                  aria-selected={false}
                  className={
                    "st-content-language-switcher__option" +
                    (activeIndex === languages.length
                      ? " st-content-language-switcher__option--active"
                      : "")
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(languages.length)}
                  onClick={openCreateModal}
                >
                  <Localized id="content-language-create-option">Add language…</Localized>
                </div>
              )}
            </div>
          )}
        </div>
      </FormElement>
      {showCreateOption && (
        <CreateLanguageModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      )}
      <DeleteLanguageModal
        language={languageToDelete}
        label={languageToDelete ? labels[languageToDelete] : undefined}
        onCancel={() => setLanguageToDelete(undefined)}
        onConfirm={() => {
          if (languageToDelete) {
            deleteLiteralsByLanguage(dataGraph, languageToDelete);
            removeLanguage(languageToDelete);
          }
          setLanguageToDelete(undefined);
        }}
      />
    </>
  );
}
