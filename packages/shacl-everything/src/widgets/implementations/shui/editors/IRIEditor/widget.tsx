import { useEffect, useState } from "react";
import { factory } from "@/helpers/factory.ts";
import { Link } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

// Mirrors shui:hasImageFileExtension (src/scoring/widget-scoring.ttl) - same extension list, kept
// in sync by hand since this only drives a live-preview toggle here, not a SHACL score rule.
const IMAGE_EXTENSION_PATTERN = /\.(jpg|jpeg|png|gif|bmp|svg|webp|avif)$/i;

export default function IRIEditor({ shape, term, setTerm, labelledBy, autoFocus }: WidgetProps) {
  const pattern = shape.get(sh("pattern"))?.source;
  const minLength = shape.get(sh("minLength"));
  const maxLength = shape.get(sh("maxLength"));

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.namedNode(value)),
  );
  const ref = useAutoFocusRef<HTMLInputElement>(autoFocus);

  // Reset once the committed value moves on - a broken image at one IRI shouldn't suppress the
  // preview forever once the user points this property at a different one.
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => setPreviewFailed(false), [term.value]);

  const showPreview =
    term.value.length > 0 && !previewFailed && IMAGE_EXTENSION_PATTERN.test(term.value);

  return (
    <div className="st-iri-editor">
      <div className="st-iri-editor__row">
        <input
          ref={ref}
          type="text"
          className="st-input"
          value={localValue}
          onChange={onChange}
          onBlur={onBlur}
          pattern={pattern}
          minLength={minLength}
          maxLength={maxLength}
          aria-labelledby={labelledBy}
        />
        {term.value ? (
          <a
            className="st-input-suffix has-value"
            href={term.value}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Link />
          </a>
        ) : (
          <span className="st-input-suffix">
            <Link />
          </span>
        )}
      </div>
      {showPreview && (
        <div className="st-iri-editor__preview">
          <img
            className="st-iri-editor__preview-image"
            src={term.value}
            alt=""
            onError={() => setPreviewFailed(true)}
          />
        </div>
      )}
    </div>
  );
}
