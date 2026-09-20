import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Localized } from "@fluent/react";
import { localName } from "@shapething/shacl-everything";
import fetchClassHierarchy from "./fetchClassHierarchy.rq";
import fetchShapes from "./fetchShapes.rq";
import fetchPropertyShapes from "./fetchPropertyShapes.rq";
import fetchOntologyProperties from "./fetchOntologyProperties.rq";
import { useSelect } from "@/hooks/useSelect";
import {
  buildClassHierarchy,
  collectShapeIris,
  filterToShapedClasses,
  type ClassHierarchyNode,
} from "./buildClassHierarchy";
import { getOntologyPropertiesForClass, getPropertyShapesForShape } from "./classDetails";
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

  const propertyShapeRows = useSelect(fetchPropertyShapes);
  const ontologyPropertyRows = useSelect(fetchOntologyProperties);

  // /class/$classIri and /shape/$shapeIri both encode a shape IRI in their param (see the Link
  // targets below) - Sidebar sits above the routed Outlet, so `strict: false` reads whichever of
  // the two is currently active instead of tying this component to one specific route.
  const routeParams = useParams({ strict: false }) as {
    classIri?: string;
    shapeIri?: string;
    propertyShapeIri?: string;
  };
  const selectedPropertyShapeIri = routeParams.propertyShapeIri
    ? decodeURIComponent(routeParams.propertyShapeIri)
    : undefined;
  // A property shape's own route has no classIri/shapeIri of its own - fall back to whichever
  // shape it's reached through (fetchPropertyShapes.rq's sh:node* walk) so the hierarchy stays
  // expanded around it instead of collapsing while its form is open. A property shape can have
  // more than one rootShape candidate (the shape that declares it directly, and any shape that
  // reuses it via sh:node) - only the one that's actually a Link somewhere in the tree/shapes
  // list is a valid expansion target.
  const knownShapeIris = collectShapeIris(hierarchy);
  for (const shape of shapes) knownShapeIris.add(shape.shape.value);
  const selectedShapeIri = routeParams.classIri
    ? decodeURIComponent(routeParams.classIri)
    : routeParams.shapeIri
      ? decodeURIComponent(routeParams.shapeIri)
      : selectedPropertyShapeIri
        ? propertyShapeRows.find(
            (row) =>
              row.propertyShape.value === selectedPropertyShapeIri &&
              knownShapeIris.has(row.rootShape.value),
          )?.rootShape.value
        : undefined;

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
        <ClassList
          nodes={nodes}
          selectedShapeIri={selectedShapeIri}
          propertyShapeRows={propertyShapeRows}
          ontologyPropertyRows={ontologyPropertyRows}
        />
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
              {shape.shape.value === selectedShapeIri && (
                // A freestanding shape (no sh:targetClass) has no class of its own, so it can
                // only ever show property shapes here, never ontology properties.
                <ShapeDetails
                  shapeIri={shape.shape.value}
                  classIri={undefined}
                  propertyShapeRows={propertyShapeRows}
                  ontologyPropertyRows={ontologyPropertyRows}
                />
              )}
            </li>
          ))}
        </ul>
      </nav>
    </Localized>
  );
}

type ClassListProps = {
  nodes: ClassHierarchyNode[];
  selectedShapeIri: string | undefined;
  propertyShapeRows: PropertyShapeRows;
  ontologyPropertyRows: OntologyPropertyRows;
};

function ClassList({ nodes, selectedShapeIri, propertyShapeRows, ontologyPropertyRows }: ClassListProps) {
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
          {node.shapeIri && node.shapeIri === selectedShapeIri && (
            <ShapeDetails
              shapeIri={node.shapeIri}
              classIri={node.iri}
              propertyShapeRows={propertyShapeRows}
              ontologyPropertyRows={ontologyPropertyRows}
            />
          )}
          <ClassList
            nodes={node.children}
            selectedShapeIri={selectedShapeIri}
            propertyShapeRows={propertyShapeRows}
            ontologyPropertyRows={ontologyPropertyRows}
          />
        </li>
      ))}
    </ul>
  );
}

type PropertyShapeRows = Parameters<typeof getPropertyShapesForShape>[0];
type OntologyPropertyRows = Parameters<typeof getOntologyPropertiesForClass>[0];

// The class/shape a sidebar row links to already opens the existing edit form (ClassRoute /
// ShapeRoute) - this is purely a read-only outline of what that form doesn't show yet: the
// shape's own property shapes (including ones reused via sh:node) and, for a class, any
// rdf:Property/owl:*Property declared with it as rdfs:domain.
function ShapeDetails({
  shapeIri,
  classIri,
  propertyShapeRows,
  ontologyPropertyRows,
}: {
  shapeIri: string;
  classIri: string | undefined;
  propertyShapeRows: PropertyShapeRows;
  ontologyPropertyRows: OntologyPropertyRows;
}) {
  const propertyShapes = getPropertyShapesForShape(propertyShapeRows, shapeIri);
  const ontologyProperties = classIri
    ? getOntologyPropertiesForClass(ontologyPropertyRows, classIri)
    : [];

  if (propertyShapes.length === 0 && ontologyProperties.length === 0) return null;

  return (
    <div className="st-manager-sidebar__details">
      {propertyShapes.length > 0 && (
        <div className="st-manager-sidebar__details-group">
          <Localized id="shacl-manager-sidebar-property-shapes">
            <span className="st-manager-sidebar__details-title">Property shapes</span>
          </Localized>
          <ul className="st-manager-sidebar__list">
            {propertyShapes.map((propertyShape) => (
              <li key={propertyShape.iri} className="st-manager-sidebar__item">
                <Link
                  to="/property-shape/$propertyShapeIri"
                  params={{ propertyShapeIri: encodeURIComponent(propertyShape.iri) }}
                  className="st-manager-sidebar__label st-manager-sidebar__label--detail"
                  activeProps={{
                    className:
                      "st-manager-sidebar__label st-manager-sidebar__label--detail st-manager-sidebar__label--active",
                  }}
                >
                  {propertyShape.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {ontologyProperties.length > 0 && (
        // No edit form exists for a bare rdf:Property/owl:*Property declaration (unlike a SHACL
        // property shape, it isn't something shacl-manager's own routes know how to render), so
        // these stay plain, non-navigable text.
        <div className="st-manager-sidebar__details-group">
          <Localized id="shacl-manager-sidebar-ontology-properties">
            <span className="st-manager-sidebar__details-title">Properties (OWL/RDFS)</span>
          </Localized>
          <ul className="st-manager-sidebar__list">
            {ontologyProperties.map((property) => (
              <li key={property.iri} className="st-manager-sidebar__item">
                <span className="st-manager-sidebar__label st-manager-sidebar__label--detail">
                  {property.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
