import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Localized } from "@fluent/react";
import { localName } from "@shapething/shacl-everything";
import fetchClassHierarchy from "./fetchClassHierarchy.rq";
import fetchShapes from "./fetchShapes.rq";
import { useSelect } from "@/hooks/useSelect";
import {
  buildClassHierarchy,
  filterToShapedClasses,
  type ClassHierarchyNode,
} from "./buildClassHierarchy";
import { factory } from "@/helpers/factory.ts";
import "./style.css";

export default function Sidebar() {
  const data = useSelect(fetchClassHierarchy);
  const [onlyWithShape, setOnlyWithShape] = useState(true);

  const hierarchy = buildClassHierarchy(data);
  const nodes = onlyWithShape ? filterToShapedClasses(hierarchy) : hierarchy;

  // A shape can have more than one rdfs:label/sh:name (both predicates, or several languages), so
  // the distinct (shape, label) rows can repeat the same shape IRI - collapse to one row per shape
  // (first label wins) before it's used as a React key.
  const shapesRaw = useSelect(fetchShapes);
  const shapesByIri = new Map<string, (typeof shapesRaw)[number]>();
  for (const shape of shapesRaw) {
    if (!shapesByIri.has(shape.shape.value)) shapesByIri.set(shape.shape.value, shape);
  }
  const shapes = [...shapesByIri.values()];

  return (
    <Localized id="shacl-manager-sidebar-nav" attrs={{ "aria-label": true }}>
      <nav className="st-manager-sidebar" aria-label="Class hierarchy">
        <label className="st-manager-sidebar__toggle">
          <input
            type="checkbox"
            checked={onlyWithShape}
            onChange={(event) => setOnlyWithShape(event.target.checked)}
          />
          <Localized id="shacl-manager-sidebar-only-with-shape">
            Only classes with a shape
          </Localized>
        </label>
        <ClassList nodes={nodes} />
        <hr />
        <ul className="st-manager-sidebar__list">
          {shapes.map((shape) => (
            <li key={shape.shape.value} className="st-manager-sidebar__item">
              <Link
                to="/shape/$shapeIri"
                params={{ shapeIri: encodeURIComponent(shape.shape.value) }}
                className="st-manager-sidebar__label"
                activeProps={{
                  className: "st-manager-sidebar__label st-manager-sidebar__label--active",
                }}
              >
                {shape.label?.value ??
                  localName(factory.namedNode(shape.shape.value)) ??
                  shape.shape.value}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Localized>
  );
}

function ClassList({ nodes }: { nodes: ClassHierarchyNode[] }) {
  if (nodes.length === 0) return null;

  return (
    <ul className="st-manager-sidebar__list">
      {nodes.map((node) => (
        // A class without its own shapeIri (no shape at all, shown when the "only with shape"
        // filter is off - or a shape that's a blank node, which has nothing to link to) still gets
        // an <li> so its shaped descendants stay reachable; only the shaped case is a Link.
        <li key={node.iri} className="st-manager-sidebar__item">
          {node.shapeIri ? (
            <Link
              to="/class/$classIri"
              params={{ classIri: encodeURIComponent(node.shapeIri) }}
              className="st-manager-sidebar__label"
              activeProps={{
                className: "st-manager-sidebar__label st-manager-sidebar__label--active",
              }}
            >
              {node.label}
            </Link>
          ) : (
            <span className="st-manager-sidebar__label st-manager-sidebar__label--unshaped">
              {node.label}
            </span>
          )}
          <ClassList nodes={node.children} />
        </li>
      ))}
    </ul>
  );
}
