import { clsx } from "clsx";
import type { ReactNode } from "react";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";
import { Help } from "@/helpers/icons.tsx";
import { Localized } from "@fluent/react";
import "./style.css";

type Props = {
  label?: ReactNode;
  labelTitle?: string;
  actions?: ReactNode;
  severity?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  tooltip?: ReactNode;
  size?: "small" | "medium";
};

export default function FormElement({
  label,
  labelTitle,
  severity,
  description,
  children,
  actions,
  className,
  tooltip,
  size = "medium",
}: Props) {
  return (
    <div className={clsx("st-form-element", className)} data-severity={severity} data-size={size}>
      <header className="st-form-element__header">
        {label && (
          <label className="st-form-element__label" title={labelTitle}>
            {label}
          </label>
        )}
        {(actions || tooltip) && (
          <div className="st-form-element__actions">
            {tooltip && (
              <Tooltip bare enabled tip={tooltip}>
                <Localized id="form-element-help" attrs={{ "aria-label": true }}>
                  <button type="button" className="st-icon-button" aria-label="Help">
                    <Help />
                  </button>
                </Localized>
              </Tooltip>
            )}
            {actions}
          </div>
        )}
      </header>
      {description && <p className="st-form-element__description">{description}</p>}
      {children}
    </div>
  );
}
