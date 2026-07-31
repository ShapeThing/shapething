import type { ReactNode } from "react";
import "./style.css";

type Props = {
  label?: ReactNode;
  labelTitle?: string;
  actions?: ReactNode;
  severity?: string;
  description?: string;
  children?: ReactNode;
};

export default function FormElement({
  label,
  labelTitle,
  severity,
  description,
  children,
  actions,
}: Props) {
  return (
    <div className="st-form-element" data-severity={severity}>
      <header className="st-form-element__header">
        {label && (
          <label className="st-form-element__label" title={labelTitle}>
            {label}
          </label>
        )}
        {actions && <div className="st-form-element__actions">{actions}</div>}
      </header>
      {description && <p className="st-form-element__description">{description}</p>}
      {children}
    </div>
  );
}
