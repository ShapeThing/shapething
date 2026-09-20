import type { TypedQuery } from "@shapething/typed-sparql";
import { localName } from "@shapething/shacl-everything";
import { factory } from "@/helpers/factory.ts";
import type fetchPropertyShapes from "./fetchPropertyShapes.rq";
import type fetchOntologyProperties from "./fetchOntologyProperties.rq";

type PropertyShapeRow = typeof fetchPropertyShapes extends TypedQuery<infer T> ? T : never;
type OntologyPropertyRow = typeof fetchOntologyProperties extends TypedQuery<infer T> ? T : never;

export type PropertyShapeInfo = {
  iri: string;
  label: string;
};

export type OntologyPropertyInfo = {
  iri: string;
  label: string;
};

// A (rootShape, propertyShape) pair can repeat - once per sh:node hop that reaches it, or once
// per sh:name/sh:order language/value - so it's collapsed to one entry per propertyShape (first
// name/order/path win) before it's used as a list.
export function getPropertyShapesForShape(
  rows: PropertyShapeRow[],
  shapeIri: string,
): PropertyShapeInfo[] {
  const byIri = new Map<string, { label: string; order: number }>();

  for (const row of rows) {
    if (row.rootShape.value !== shapeIri) continue;
    if (byIri.has(row.propertyShape.value)) continue;

    const pathIri = row.path?.termType === "NamedNode" ? row.path : undefined;
    byIri.set(row.propertyShape.value, {
      label:
        row.name?.value ??
        (pathIri && localName(pathIri)) ??
        localName(factory.namedNode(row.propertyShape.value)) ??
        row.propertyShape.value,
      order: row.order?.value !== undefined ? Number(row.order.value) : Number.POSITIVE_INFINITY,
    });
  }

  return [...byIri.entries()]
    .map(([iri, { label, order }]) => ({ iri, label, order }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map(({ iri, label }) => ({ iri, label }));
}

// A (property, domain) pair can repeat across its rdfs:label languages - collapse to one entry
// per property (first label wins) before it's used as a list.
export function getOntologyPropertiesForClass(
  rows: OntologyPropertyRow[],
  classIri: string,
): OntologyPropertyInfo[] {
  const byIri = new Map<string, string>();

  for (const row of rows) {
    if (row.domain.value !== classIri) continue;
    if (byIri.has(row.property.value)) continue;

    byIri.set(
      row.property.value,
      row.label?.value ?? localName(factory.namedNode(row.property.value)) ?? row.property.value,
    );
  }

  return [...byIri.entries()]
    .map(([iri, label]) => ({ iri, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
