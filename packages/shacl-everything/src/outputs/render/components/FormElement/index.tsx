import { clsx } from "clsx";
import type { ReactNode } from "react";
import Tooltip, { type Placement } from "@/outputs/render/components/Tooltip/index.tsx";
import { Help } from "@/helpers/icons.tsx";
import { Localized } from "@fluent/react";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import "./style.css";

type Props = {
  label?: ReactNode;
  labelTitle?: string;
  htmlFor?: string;
  // Id put on the <label> element itself, for a caller whose label describes more than one
  // rendered control (e.g. a multi-valued property's one label above several widget instances) -
  // those controls point back at it via aria-labelledby, since htmlFor/id only pairs one-to-one.
  labelId?: string;
  actions?: ReactNode;
  description?: string;
  children?: ReactNode;
  className?: string;
  tooltip?: ReactNode;
  // Preferred side for the tooltip - see Tooltip's own `placement` prop.
  tooltipPlacement?: Placement;
  showColon?: boolean;
  size?: "small" | "medium";
  // "block" (default) stacks the label above children, same as always. "inline" instead places
  // the label beside children on one line - view mode only, driven by
  // Environment.viewModeLabelLayout (see view mode's PropertyUIComponent).
  labelLayout?: "block" | "inline";
};

export default function FormElement({
  label,
  labelTitle,
  htmlFor,
  labelId,
  description,
  children,
  actions,
  className,
  tooltip,
  tooltipPlacement,
  size = "medium",
  showColon = false,
  labelLayout = "block",
}: Props) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();

  return (
    <div
      className={clsx("st-form-element", className)}
      data-size={size}
      data-label-layout={labelLayout}
    >
      <header className="st-form-element__header">
        {label && (
          <label
            className="st-form-element__label"
            id={labelId}
            htmlFor={htmlFor}
            title={labelTitle}
            lang={activeInterfaceLanguage}
          >
            {label}
          </label>
        )}
        {showColon && label && (
          <span className="st-form-element__label-colon" aria-hidden>
            :
          </span>
        )}
        {(actions || tooltip) && (
          <div className="st-form-element__actions">
            {tooltip && (
              <Tooltip bare enabled tip={tooltip} placement={tooltipPlacement}>
                <Localized id="form-element-help" attrs={{ "aria-label": true }}>
                  {/* Sits before the field itself in the DOM, so a normal tab stop here would
                      interrupt Tab from the label reaching the field - it's still reachable by
                      mouse/touch, and by keyboard once the field itself is focused. */}
                  <button
                    type="button"
                    className="st-icon-button st-icon-button--help"
                    aria-label="Help"
                    tabIndex={-1}
                  >
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
