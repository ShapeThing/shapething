import { useCallback, useState, type ReactNode } from "react";
import "./style.css";
import type { Severity } from "@/types/severity.ts";

type Props = {
  tip: ReactNode;
  children: ReactNode;
  enabled: boolean;
  severity?: Severity;
};

export default function Tooltip({ tip, children, enabled, severity }: Props) {
  const [showTooltip, setShowTooltip] = useState(true);

  const open = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const close = useCallback(() => {
    setShowTooltip(false);
  }, []);

  return !enabled ? (
    children
  ) : (
    <div
      className={`tooltip-wrapper${severity ? ` severity-${severity}` : ""}`}
      tabIndex={0}
      onFocus={open}
      onBlur={close}
      onMouseEnter={open}
      onMouseLeave={close}
    >
      {showTooltip && <div className="tooltip">{tip}</div>}
      {children}
    </div>
  );
}
