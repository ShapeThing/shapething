import { Localized } from "@fluent/react";
import "./style.css";
import { Violation, Warning, Info } from "@/helpers/icons.tsx";

export type ValidationMessage = {
  // The violated shape's sh:severity local name (e.g. "Violation"/"Warning"/"Info") - kept as the
  // SHACL vocabulary term rather than the lowercase Severity keyword Tooltip uses elsewhere, to
  // match FormElement's own existing data-severity convention.
  severity: string;
  message: string;
};

const SEVERITY_ICONS: Record<string, typeof Violation> = {
  Violation,
  Warning,
  Info,
};

// SHACL's own sh:Violation/sh:Warning/sh:Info have no rdfs:label, and their local names read as
// spec jargon ("Violation") rather than the "Error"/"Warning"/"Info" wording used everywhere else
// in this UI (see the Severity type and its severity-error CSS class) - so the display label
// comes from these interface-language ftl bundles instead of the vocabulary.
const SEVERITY_LABEL_IDS: Record<string, string> = {
  Violation: "validation-severity-violation",
  Warning: "validation-severity-warning",
  Info: "validation-severity-info",
};

/**
 * Renders `messages` as a small list, one per SHACL validation result - shared by
 * PropertyUIComponent.tsx (property-wide messages) and PropertyUIComponentObject.tsx (per-value
 * messages) rather than growing FormElement's prop surface for this one feature.
 */
export default function ValidationMessages({
  messages,
  className,
}: {
  messages: ValidationMessage[];
  className?: string;
}) {
  if (messages.length === 0) return null;

  return (
    <ul className={className ? `st-validation-messages ${className}` : "st-validation-messages"}>
      {messages.map((message, index) => {
        const Icon = SEVERITY_ICONS[message.severity] ?? Info;
        const labelId = SEVERITY_LABEL_IDS[message.severity];
        return (
          <li key={index} className="st-validation-message" data-severity={message.severity}>
            <span className="st-validation-message-icon">
              <Icon />
            </span>
            <span className="st-validation-message-text">
              {labelId && (
                <Localized id={labelId}>
                  <strong className="st-validation-message-severity">{message.severity}</strong>
                </Localized>
              )}
              {message.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
