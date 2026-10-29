import { Link, Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import type { NamedNode } from "@rdfjs/types";
import type { CSSProperties } from "react";
import { useT } from "@/app/useT.ts";
import type { FocusSearch } from "@/app/router.tsx";
import { useDataModel } from "@/data-model/useDataModel.ts";
import { useLabels } from "@/data-model/useLabels.ts";
import { compactIri, termKey } from "@/helpers/iri.ts";
import { useOntology } from "@/ontology/useOntology.ts";
import ClassForm from "@/ontology/ClassForm.tsx";
import { targetClassesOf } from "@/shapes/model.ts";
import NodeShapeForm from "@/shapes/NodeShapeForm.tsx";
import { useShapes } from "@/shapes/useShapes.ts";
import { useAlignedProperties } from "@/alignment/useAlignedProperties.ts";
import AncestorTrail from "./AncestorTrail.tsx";
import PropertyPanel from "./PropertyPanel.tsx";
import PropertyTable from "./PropertyTable.tsx";
import ColumnResizer from "./ColumnResizer.tsx";
import { PANEL_BOUNDS, SIDEBAR_BOUNDS, useResizableWidth } from "./useResizableWidth.ts";
import "./style.css";

export default function FocusView({
  kind,
  focusKey,
}: {
  kind: "shape" | "class";
  focusKey: string;
}) {
  const t = useT();
  const labels = useLabels();
  const { isEditable, isLocal } = useDataModel();
  const { classes } = useOntology();
  const shapes = useShapes();
  const search = useSearch({ strict: false }) as FocusSearch;
  const navigate = useNavigate();
  const [sidebarWidth, resizeSidebar] = useResizableWidth("sidebar", SIDEBAR_BOUNDS);
  const [panelWidth, resizePanel] = useResizableWidth("panel", PANEL_BOUNDS);

  const shape = kind === "shape" ? shapes.nodeShapes.get(focusKey) : undefined;
  const owlClass = kind === "class" ? classes.get(focusKey)?.term : undefined;
  const hidden = new Set(search.hidden ?? []);
  const rows = useAlignedProperties({ shape, owlClass }, hidden);

  // A shape that targets a class is shown in that class's view, together with the class's other
  // shapes; only shapes without a class target (e.g. reused via sh:node) get a view of their own.
  const shapeClass = shape && targetClassesOf(shape)[0];
  if (shapeClass) {
    return (
      <Navigate
        to="/class/$class"
        params={{ class: encodeURIComponent(shapeClass.value) }}
        search={{ edit: search.edit }}
        replace
      />
    );
  }

  if (!shape && !owlClass) {
    return (
      <p className="st-manager-notice">
        {t("shacl-manager-not-found", { key: focusKey }, `Nothing found for ${focusKey}.`)}{" "}
        <Link to="/">{t("shacl-manager-overview", null, "Overview")}</Link>
      </p>
    );
  }

  const subject = (shape?.term ?? owlClass)!;
  const focusClasses = shape ? targetClassesOf(shape) : [owlClass!];
  const namedShape = shape?.term.termType === "NamedNode" ? (shape.term as NamedNode) : undefined;
  const classShapes = owlClass ? (shapes.shapesByClass.get(owlClass.value) ?? []) : [];
  const toggleShape = (shapeKey: string) => {
    const next = new Set(hidden);
    if (!next.delete(shapeKey)) next.add(shapeKey);
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        hidden: next.size ? [...next] : undefined,
      }),
    });
  };
  const selected = rows.find((row) => row.key === search.property);

  // ?edit= names what the side panel edits: the focus itself, or one of the class's shapes.
  const editedShape = search.edit ? shapes.nodeShapes.get(search.edit) : undefined;
  const editShape = editedShape?.term;
  const editClass = owlClass && search.edit === owlClass.value ? owlClass : undefined;
  const panelOpen = Boolean(selected || editShape || editClass);

  // Where "add a property shape" puts a new property shape: the shape in focus, or for a class
  // the first shape of the data model's own that targets it.
  const addTarget =
    namedShape ??
    (classShapes.find((s) => s.term.termType === "NamedNode" && isLocal(s.term))?.term as
      | NamedNode
      | undefined);

  return (
    <div
      className={`st-manager-focus${panelOpen ? " st-manager-focus--panel" : ""}`}
      style={
        {
          "--st-manager-sidebar-width": `${sidebarWidth}px`,
          "--st-manager-panel-width": `${panelWidth}px`,
        } as CSSProperties
      }
    >
      <div className="st-manager-sidebar">
        <AncestorTrail
          focusClasses={focusClasses}
          shapeSelection={{ hidden, toggle: toggleShape }}
          nodeShapes={shape ? (shapes.nodeReferences.get(shape.key) ?? []) : []}
        />
        <ColumnResizer
          width={sidebarWidth}
          resize={resizeSidebar}
          bounds={SIDEBAR_BOUNDS}
          edge="right"
          label={t("shacl-manager-resize-sidebar", null, "Resize sidebar")}
        />
      </div>

      <section className="st-manager-focus__main">
        <header className="st-manager-focus__header">
          <div>
            <h1 className="st-manager-title">
              {shape ? "◆ " : ""}
              {labels.display(subject)}
              {!isEditable(subject) && (
                <span className="st-manager-badge">
                  {t("shacl-manager-read-only", null, "import · read-only")}
                </span>
              )}
            </h1>
            <p className="st-manager-muted">
              {shape
                ? shape.targets.length
                  ? shape.targets
                      .map((target) => `${target.kind}: ${labels.display(target.target)}`)
                      .join(" · ")
                  : t("shacl-manager-untargeted", null, "No target")
                : compactIri(subject.value)}
            </p>
          </div>
          {(shape ?? owlClass) && (
            <Link
              to="."
              search={(prev: Record<string, unknown>) => ({
                ...prev,
                property: undefined,
                edit: search.edit === focusKey ? undefined : focusKey,
              })}
              className="st-button"
            >
              {t("shacl-manager-edit", null, "Edit")} ✎
            </Link>
          )}
        </header>

        {owlClass && classShapes.length === 0 && (
          <p className="st-manager-notice">
            {t(
              "shacl-manager-class-without-shape",
              null,
              "This class has no shape of its own. Properties below come from the ontology and from shapes on its superclasses.",
            )}
          </p>
        )}

        <PropertyTable rows={rows} selected={selected?.key} compact={panelOpen} />
      </section>

      {panelOpen && (
        <div className="st-manager-panel-column">
          <ColumnResizer
            width={panelWidth}
            resize={resizePanel}
            bounds={PANEL_BOUNDS}
            edge="left"
            label={t("shacl-manager-resize-panel", null, "Resize panel")}
          />
          {editShape && (
            <aside className="st-manager-panel">
              <NodeShapeForm key={termKey(editShape)} shape={editShape} />
            </aside>
          )}
          {editClass && (
            <aside className="st-manager-panel">
              <ClassForm key={editClass.value} owlClass={editClass} />
            </aside>
          )}
          {!editShape && !editClass && selected && (
            <PropertyPanel row={selected} focusShape={addTarget} />
          )}
        </div>
      )}
    </div>
  );
}
