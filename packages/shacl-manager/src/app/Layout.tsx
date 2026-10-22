import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useDataModel } from "@/data-model/useDataModel.ts";
import { useLabels } from "@/data-model/useLabels.ts";
import "./style.css";

export default function Layout({ children }: { children: ReactNode }) {
  const { dataModelIRI } = useDataModel();
  const labels = useLabels();

  return (
    <div className="st-manager">
      <header className="st-manager__header">
        <Link to="/" className="st-manager__title">
          {labels.display(dataModelIRI)}
        </Link>
        <code className="st-manager__iri">{dataModelIRI.value}</code>
      </header>
      <main className="st-manager__main">{children}</main>
    </div>
  );
}
