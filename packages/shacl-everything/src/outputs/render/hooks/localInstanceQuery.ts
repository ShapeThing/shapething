import { QueryEngine } from "@comunica/query-sparql-rdfjs-lite";
import type { NamedNode, Term } from "@rdfjs/types";
import { queryPrefixes, sh } from "@/helpers/namespaces.ts";
import {
  depictionRolePropertyPaths,
  labelRolePropertyPaths,
  subLabelRolePropertyPaths,
} from "@/resolution/label.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

const RESULT_LIMIT = 50;

// A label match beats an IRI match; an instance matching on both outscores either alone.
const LABEL_MATCH_WEIGHT = 2;
const IRI_MATCH_WEIGHT = 1;

// Comunica recommends reusing one engine instance across queries for optimal performance. This is
// the lightweight RDF/JS-source-only engine - it only ever queries the already-loaded local
// dataGraph, never a remote endpoint (see useSelectOptions.tsx for the federated case, which needs
// the full @comunica/query-sparql engine instead).
const engine = new QueryEngine();

export type SearchResult = {
  iri: NamedNode;
  label?: string;
  subLabel?: string;
  depiction?: NamedNode;
};

function escapeSparqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * A SPARQL query for every instance of `classIri` whose IRI or LabelRole label contains `search`
 * (case-insensitive), ranked by a ?score - a label match scores higher than an IRI match, and an
 * instance matching both outscores either alone. Results are ordered by descending score, so
 * callers can rely on array order rather than re-sorting client-side. `labelPaths` are SPARQL
 * property path expressions (see toSparql.ts) from a candidate instance to its label literal(s) -
 * left out of the scoring entirely when there are none, so a class with no shui:LabelRole still
 * searches by IRI alone. `subLabelPaths` and `depictionPaths` are walked the same way to bind
 * `?subLabel`/`?depiction` alongside each result, so the SubLabelRole text and DepictionRole image
 * are tied to this query instead of being re-fetched per result once results are in hand -
 * important once federated autocompletes mean that data has to flow through Comunica rather than a
 * local dataGraph walk (see valueNodeDepiction).
 */
export function buildSearchQuery(
  classIri: NamedNode,
  labelPaths: string[],
  subLabelPaths: string[],
  depictionPaths: string[],
  search: string,
): string {
  const needle = escapeSparqlString(search.trim().toLowerCase());
  const labelPattern =
    labelPaths.length > 0 ? `optional { ?iri ${labelPaths.join("|")} ?iriLabel }` : "";
  const labelScoreExpression =
    labelPaths.length > 0
      ? `if(bound(?iriLabel) && contains(lcase(str(?iriLabel)), "${needle}"), ${LABEL_MATCH_WEIGHT}, 0)`
      : "0";
  const subLabelPattern =
    subLabelPaths.length > 0 ? `optional { ?iri ${subLabelPaths.join("|")} ?iriSubLabel }` : "";
  const depictionPattern =
    depictionPaths.length > 0 ? `optional { ?iri ${depictionPaths.join("|")} ?iriDepiction }` : "";

  return `
    ${queryPrefixes}
    select ?iri (sample(?iriLabel) as ?label) (sample(?iriSubLabel) as ?subLabel) (sample(?iriDepiction) as ?depiction) (max(?matchScore) as ?score) where {
      ?iri a <${classIri.value}> .
      ${labelPattern}
      ${subLabelPattern}
      ${depictionPattern}
      bind(${labelScoreExpression} as ?labelScore)
      bind(if(contains(lcase(str(?iri)), "${needle}"), ${IRI_MATCH_WEIGHT}, 0) as ?iriScore)
      bind(?labelScore + ?iriScore as ?matchScore)
      filter(?matchScore > 0)
    }
    group by ?iri
    order by desc(?score)
    limit ${RESULT_LIMIT}
  `;
}

/**
 * A SPARQL query resolving every one of `iris` (e.g. a set of sh:in options, or a property's
 * current value) to its LabelRole label, SubLabelRole text and DepictionRole image in one round
 * trip, the same way buildSearchQuery does for search results - binding all of them via a single
 * `values` clause instead of one query per iri keeps this O(1) queries rather than O(n).
 */
export function buildLookupQuery(
  iris: NamedNode[],
  labelPaths: string[],
  subLabelPaths: string[],
  depictionPaths: string[],
): string {
  const labelPattern =
    labelPaths.length > 0 ? `optional { ?iri ${labelPaths.join("|")} ?iriLabel }` : "";
  const subLabelPattern =
    subLabelPaths.length > 0 ? `optional { ?iri ${subLabelPaths.join("|")} ?iriSubLabel }` : "";
  const depictionPattern =
    depictionPaths.length > 0 ? `optional { ?iri ${depictionPaths.join("|")} ?iriDepiction }` : "";
  const values = iris.map((iri) => `<${iri.value}>`).join(" ");

  return `
    ${queryPrefixes}
    select ?iri (sample(?iriLabel) as ?label) (sample(?iriSubLabel) as ?subLabel) (sample(?iriDepiction) as ?depiction) where {
      values ?iri { ${values} }
      ${labelPattern}
      ${subLabelPattern}
      ${depictionPattern}
    }
    group by ?iri
  `;
}

// Shared by searchInstances and fetchOptions - both queries select the same
// ?iri/?label/?subLabel/?depiction shape, just with a different where-clause.
function toSearchResults(bindings: { get(name: string): Term | undefined }[]): SearchResult[] {
  return bindings.flatMap((binding): SearchResult[] => {
    const iri = binding.get("iri");
    if (iri?.termType !== "NamedNode") return [];

    const labelTerm = binding.get("label");
    const subLabelTerm = binding.get("subLabel");
    const depictionTerm = binding.get("depiction");

    return [
      {
        iri,
        label: labelTerm?.termType === "Literal" ? labelTerm.value : undefined,
        subLabel: subLabelTerm?.termType === "Literal" ? subLabelTerm.value : undefined,
        depiction: depictionTerm?.termType === "NamedNode" ? depictionTerm : undefined,
      },
    ];
  });
}

/**
 * Instances of this property's sh:class whose IRI or LabelRole label matches `search`, found via
 * Comunica against the already-loaded dataGraph. shacl-everything preprocesses every configured
 * source into one local RdfStore up front (see preprocess/resolveRdfSources.ts), so there is no
 * separate remote endpoint to query - Comunica here just expresses the search as SPARQL over data
 * that's already local, the same data other widgets read with plain getQuads() calls.
 */
export async function searchInstances(
  shape: PropertyUIElement,
  search: string,
): Promise<SearchResult[]> {
  const classIri = shape.getOne(sh("class")) as NamedNode | undefined;
  if (!classIri) return [];

  const labelPaths = labelRolePropertyPaths(shape).map(toSparql);
  const subLabelPaths = subLabelRolePropertyPaths(shape).map(toSparql);
  const depictionPaths = depictionRolePropertyPaths(shape).map(toSparql);
  const query = buildSearchQuery(classIri, labelPaths, subLabelPaths, depictionPaths, search);

  const bindingsStream = await engine.queryBindings(query, {
    sources: [shape.dataGraph],
  });
  return toSearchResults(await bindingsStream.toArray());
}

/**
 * Resolves every one of `iris` (e.g. this property's currently applied value, or its sh:in
 * options) to its LabelRole label and DepictionRole image via Comunica, the same way search
 * results are resolved - in a single batched query rather than one per iri. Lets AutoCompleteOption
 * stay a plain presentational component that never reads the data graph itself - see
 * buildLookupQuery.
 */
export async function fetchOptions(
  shape: PropertyUIElement,
  iris: NamedNode[],
): Promise<SearchResult[]> {
  if (iris.length === 0) return [];

  const labelPaths = labelRolePropertyPaths(shape).map(toSparql);
  const subLabelPaths = subLabelRolePropertyPaths(shape).map(toSparql);
  const depictionPaths = depictionRolePropertyPaths(shape).map(toSparql);
  const query = buildLookupQuery(iris, labelPaths, subLabelPaths, depictionPaths);

  const bindingsStream = await engine.queryBindings(query, {
    sources: [shape.dataGraph],
  });
  return toSearchResults(await bindingsStream.toArray());
}
