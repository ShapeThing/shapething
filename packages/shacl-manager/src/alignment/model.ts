import type { NamedNode, Term } from "@rdfjs/types";
import type { OwlProperty, PropertyIndex } from "@/ontology/model.ts";
import type { PropertyShape } from "@/shapes/model.ts";
import type { PathInfo } from "@/shapes/paths.ts";
import type { Origin, ResolvedPropertyShape } from "@/shapes/resolveProperties.ts";

/**
 * How a SHACL property shape and the ontology relate:
 * - merged: sh:path is a plain IRI that is an OWL/RDF property. One thing, two sides, one form.
 * - split: a complex sh:path that contains OWL/RDF properties. Shown as separate forms.
 * - shape: no ontology property involved.
 * - ontology: an OWL/RDF property in scope (rdfs:domain) that no shape talks about.
 */
export type AlignmentKind = "merged" | "split" | "shape" | "ontology";

export type AlignedOrigin =
  | Origin
  // Class focus: defined on a shape that targets the class in focus.
  | { kind: "targeting"; shape: Term }
  | { kind: "domain"; owlClass: NamedNode };

export type AlignedProperty = {
  key: string;
  kind: AlignmentKind;
  propertyShape?: PropertyShape;
  path?: PathInfo;
  owlProperties: OwlProperty[];
  origin: AlignedOrigin;
};

export function alignPropertyShape(
  propertyShape: PropertyShape,
  origin: AlignedOrigin,
  properties: PropertyIndex,
  describe: (path: Term) => PathInfo,
): AlignedProperty {
  const path = propertyShape.path ? describe(propertyShape.path) : undefined;
  const owlProperties = (path?.iris ?? [])
    .map((iri) => properties.get(iri.value))
    .filter((property): property is OwlProperty => property !== undefined);

  const kind: AlignmentKind =
    owlProperties.length === 0 ? "shape" : path?.predicate ? "merged" : "split";

  return { key: propertyShape.key, kind, propertyShape, path, owlProperties, origin };
}

/**
 * The full property list for a focus: every resolved property shape aligned with the ontology,
 * followed by ontology-only properties whose rdfs:domain is one of `scopeClasses` (the focus class
 * first, then its ancestors). An OWL property already covered by a merged or split row is not
 * listed again.
 */
export function alignProperties(
  resolved: (Omit<ResolvedPropertyShape, "origin"> & { origin: AlignedOrigin })[],
  scopeClasses: NamedNode[],
  properties: PropertyIndex,
  describe: (path: Term) => PathInfo,
): AlignedProperty[] {
  const aligned = resolved.map(({ propertyShape, origin }) =>
    alignPropertyShape(propertyShape, origin, properties, describe),
  );

  const covered = new Set(aligned.flatMap((row) => row.owlProperties.map((p) => p.iri)));

  for (const owlClass of scopeClasses) {
    for (const property of properties.values()) {
      if (covered.has(property.iri) || !property.domains.has(owlClass.value)) continue;
      covered.add(property.iri);
      aligned.push({
        key: property.iri,
        kind: "ontology",
        owlProperties: [property],
        origin: { kind: "domain", owlClass },
      });
    }
  }

  return aligned;
}

/** A stable heading key per origin, so rows can be grouped in the order they were produced. */
export function originKey(origin: AlignedOrigin): string {
  switch (origin.kind) {
    case "defined":
      return "defined";
    case "node":
      return `node:${origin.root?.value ?? ""}:${origin.via.value}`;
    case "inherited":
      return `inherited:${origin.shape.value}`;
    case "targeting":
      return `targeting:${origin.shape.value}`;
    case "domain":
      return `domain:${origin.owlClass.value}`;
  }
}

export function groupByOrigin(
  rows: AlignedProperty[],
): { origin: AlignedOrigin; rows: AlignedProperty[] }[] {
  const groups = new Map<string, { origin: AlignedOrigin; rows: AlignedProperty[] }>();
  for (const row of rows) {
    const key = originKey(row.origin);
    const group = groups.get(key) ?? { origin: row.origin, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}
