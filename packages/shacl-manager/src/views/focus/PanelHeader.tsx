import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useT } from "@/app/useT.ts";

/** A side panel's title with a close button that clears `param` from the search. */
export default function PanelHeader({
  param,
  children,
}: {
  param: "property" | "edit";
  children: ReactNode;
}) {
  const t = useT();
  return (
    <header className="st-manager-panel__header">
      <h2 className="st-manager-heading">{children}</h2>
      <Link
        to="."
        search={(prev: Record<string, unknown>) => ({ ...prev, [param]: undefined })}
        className="st-icon-button"
        aria-label={t("shacl-manager-close", null, "Close")}
      >
        ✕
      </Link>
    </header>
  );
}
