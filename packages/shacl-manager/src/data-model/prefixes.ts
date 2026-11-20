import type { NamedNode } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";

const factory = new DataFactory();

// What may follow "prefix:" for the prefixed name to read back unambiguously (no "/", "#", "?").
const LOCAL_NAME = /^[\w.-]*$/;

// The shortest prefixed name for an IRI (longest matching namespace), or undefined when no
// declared namespace fits.
export function compactIri(iri: string, prefixes: Record<string, string>): string | undefined {
  let best: [alias: string, namespace: string] | undefined;
  for (const [alias, namespace] of Object.entries(prefixes)) {
    if (!namespace || !iri.startsWith(namespace)) continue;
    if (!LOCAL_NAME.test(iri.slice(namespace.length))) continue;
    if (!best || namespace.length > best[1].length) best = [alias, namespace];
  }
  return best && `${best[0]}:${iri.slice(best[1].length)}`;
}

// A URL segment names an IRI as a prefixed name when one fits (skos:Concept), else as the full
// IRI. Anything with "://" in it is a full IRI; everything else is read as a prefixed name, and
// an unknown prefix falls back to the full IRI as written. ":" is valid in a path segment, so it
// stays readable (#/shapes/managed/class/skos:Concept); "/", "#" and the like are encoded.
export function iriToSegment(iri: string, prefixes: Record<string, string>): string {
  return encodeURIComponent(compactIri(iri, prefixes) ?? iri).replaceAll("%3A", ":");
}

export function segmentToIri(segment: string, prefixes: Record<string, string>): NamedNode {
  if (!segment.includes("://")) {
    const colon = segment.indexOf(":");
    const namespace = colon >= 0 ? prefixes[segment.slice(0, colon)] : undefined;
    if (namespace !== undefined) return factory.namedNode(namespace + segment.slice(colon + 1));
  }
  return factory.namedNode(segment);
}
