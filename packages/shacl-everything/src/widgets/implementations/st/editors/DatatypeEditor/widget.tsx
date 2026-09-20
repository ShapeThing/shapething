import { useEffect, useMemo, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import { factory } from "@/helpers/factory.ts";
import { Close, Link } from "@/helpers/icons.tsx";
import { localName } from "@/helpers/localName.ts";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import { curatedDatatypes } from "./datatypes.ts";
import "./style.css";

/**
 * Edits a `sh:datatype` value - i.e. this widget only ever appears when the property shape *being
 * edited* is itself describing a datatype constraint (see score.ttl), the "meta shape" scenario
 * shacl-manager uses to let a user edit SHACL shapes visually. `sh:in` isn't used here even though
 * it's the established closed-enumeration mechanism (see EnumSelectEditor) - it would also become a
 * real validation constraint on every shape edited through this form, wrongly rejecting any valid
 * datatype outside whatever list is curated. Instead: a curated list for the common case, plus a
 * free-text IRI fallback for anything else (a custom datatype, or a rarer XSD facet type).
 */
export default function DatatypeEditor({ term, setTerm, labelledBy, autoFocus }: WidgetProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);
  // Enter applies and then blurs the about-to-unmount input (returning to the list view) - the
  // browser's own blur-on-removal can fire onBlur a second time for the same interaction, so this
  // guards applyCustom against running twice for one Enter/blur.
  const appliedRef = useRef(false);

  useEffect(() => {
    if (customMode) {
      appliedRef.current = false;
      customInputRef.current?.focus();
    }
  }, [customMode]);

  const options = useMemo(() => curatedDatatypes.map((datatype) => datatype.term.value), []);

  const renderLabel = (iri: string) => {
    if (!iri) return <Localized id="select-an-option">- Select an option -</Localized>;
    const curated = curatedDatatypes.find((datatype) => datatype.term.value === iri);
    const name = localName(factory.namedNode(iri));
    if (!curated) return <span className="st-datatype-editor__option">{name || iri}</span>;
    return (
      <span className="st-datatype-editor__option">
        <Localized id={curated.ftlId}>{name ?? iri}</Localized>
        {name && <span className="st-datatype-editor__qname">{name}</span>}
      </span>
    );
  };

  const openCustom = () => {
    setCustomValue(term.value);
    setCustomMode(true);
  };

  const applyCustom = () => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    const iri = customValue.trim();
    if (iri) setTerm(factory.namedNode(iri));
    setCustomMode(false);
  };

  // Also guards against the same blur-on-unmount as applyCustom - otherwise a discard (Escape, the
  // Close button) could still be immediately followed by the input's own onBlur committing
  // whatever was typed.
  const discardCustom = () => {
    appliedRef.current = true;
    setCustomMode(false);
  };

  if (customMode) {
    return (
      <div className="st-datatype-editor st-datatype-editor--custom">
        <input
          ref={customInputRef}
          type="text"
          className="st-input"
          aria-labelledby={labelledBy}
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          onBlur={applyCustom}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyCustom();
            } else if (event.key === "Escape") {
              discardCustom();
            }
          }}
        />
        <Localized id="modal-close" attrs={{ "aria-label": true }}>
          <button
            type="button"
            className="st-button st-datatype-editor__cancel"
            aria-label="Close"
            // onMouseDown (not onClick alone) keeps the input's own onBlur from racing this and
            // committing whatever was typed before discardCustom's guard is set.
            onMouseDown={(event) => {
              event.preventDefault();
              discardCustom();
            }}
          >
            <Close />
          </button>
        </Localized>
      </div>
    );
  }

  return (
    <SelectListbox
      wrapperClassName="st-datatype-editor"
      ariaLabelledby={labelledBy}
      autoFocus={autoFocus}
      value={term.value}
      options={options}
      onChange={(iri) => setTerm(factory.namedNode(iri))}
      renderTriggerContent={renderLabel}
      renderOption={renderLabel}
      extraRow={{
        content: (
          <span className="st-create-option">
            <Link />
            <Localized id="datatype-custom-option">Use custom IRI…</Localized>
          </span>
        ),
        onActivate: openCustom,
      }}
    />
  );
}
