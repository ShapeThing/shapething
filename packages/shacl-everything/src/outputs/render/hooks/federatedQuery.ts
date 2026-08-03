import type { NamedNode, Term } from "@rdfjs/types";
import { queryPrefixes } from "@/helpers/namespaces.ts";
import {
  depictionRolePropertyPaths,
  labelRolePropertyPaths,
  subLabelRolePropertyPaths,
} from "@/resolution/label.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export type FederatedResult = {
  term: Term;
  label?: string;
  subLabel?: string;
  depiction?: NamedNode;
};

// A federated search must not declare its own LIMIT/OFFSET (per shui:searchQuery's spec) - the
// renderer adds one instead, capping how many candidate values a single search round trip returns.
const SEARCH_RESULT_LIMIT = 50;

// The endpoint a federated sh:select/shui:searchQuery fetches ?value from - role-resolution needs
// to run against that same endpoint, since ?value is a remote IRI in that case and plain triple
// patterns only ever see the local dataGraph. Only the first SERVICE clause is considered; a query
// federating across several endpoints is out of scope.
function extractServiceEndpoint(query: string): string | undefined {
  return query.match(/\bSERVICE\s*(?:SILENT\s+)?<([^>]+)>/i)?.[1];
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// dbpedia-style data tags literals with a bare language subtag ("en"), not a full BCP47 tag
// ("en-GB") - matching just the primary subtag is a reasonable approximation of proper language
// negotiation for a SPARQL-side FILTER, without needing full RFC 4647 lookup here too.
function primaryLanguageSubtag(uiLanguage: string): string {
  return uiLanguage.split("-")[0];
}

async function runRawQuery(
  query: string,
  propertyShape: PropertyUIElement,
): Promise<FederatedResult[]> {
  const { QueryEngine } = await import("@comunica/query-sparql");
  const engine = new QueryEngine();
  const bindingsStream = await engine.queryBindings(query, { sources: [propertyShape.dataGraph] });
  const bindings = await bindingsStream.toArray();

  return bindings.flatMap((binding): FederatedResult[] => {
    const term = binding.get("value");
    if (!term) return [];

    const labelTerm = binding.get("label");
    const subLabelTerm = binding.get("subLabel");
    const depictionTerm = binding.get("depiction");

    return [
      {
        term,
        label: labelTerm?.termType === "Literal" ? labelTerm.value : undefined,
        subLabel: subLabelTerm?.termType === "Literal" ? subLabelTerm.value : undefined,
        depiction: depictionTerm?.termType === "NamedNode" ? depictionTerm : undefined,
      },
    ];
  });
}

/**
 * A single self-contained request resolving every one of `values`' LabelRole/SubLabelRole/
 * DepictionRole via a `VALUES` clause - the federated counterpart to localInstanceQuery.ts's
 * buildLookupQuery. Wrapped in `SERVICE <endpoint>` when one was detected on the query that
 * produced `values` (so the whole lookup stays a single HTTP request to that endpoint instead of
 * something Comunica's join planner could split further); left unwrapped when there's no known
 * endpoint, i.e. the roles live in the local dataGraph.
 */
function buildRoleLookupQuery(
  values: Term[],
  labelPaths: string[],
  subLabelPaths: string[],
  depictionPaths: string[],
  uiLanguage: string,
  endpoint: string | undefined,
): string {
  const language = primaryLanguageSubtag(uiLanguage);
  const languageFilter = (variable: string) =>
    `filter(lang(${variable}) = "${language}" || lang(${variable}) = "")`;

  const patterns = [
    labelPaths.length > 0 &&
      `optional { ?value ${labelPaths.join("|")} ?roleLabel . ${languageFilter("?roleLabel")} }`,
    subLabelPaths.length > 0 &&
      `optional { ?value ${subLabelPaths.join("|")} ?roleSubLabel . ${languageFilter("?roleSubLabel")} }`,
    depictionPaths.length > 0 && `optional { ?value ${depictionPaths.join("|")} ?roleDepiction }`,
  ]
    .filter((pattern): pattern is string => Boolean(pattern))
    .join("\n");

  const valuesClause = `values ?value { ${values.map((value) => `<${value.value}>`).join(" ")} }`;
  const where = endpoint
    ? `service <${endpoint}> { ${valuesClause} ${patterns} }`
    : `${valuesClause} ${patterns}`;

  return `
    ${queryPrefixes}
    select ?value (sample(?roleLabel) as ?label) (sample(?roleSubLabel) as ?subLabel) (sample(?roleDepiction) as ?depiction) where {
      ${where}
    }
    group by ?value
  `;
}

/**
 * Runs a federated query that projects `?value` (a `sh:in [ sh:select ]`/`shui:searchQuery` body),
 * resolving each result's LabelRole/SubLabelRole/DepictionRole via `propertyShape`'s sh:node - the
 * "Using Dynamic SHACL and shui:propertyRole" mechanism. When the shape declares none of those
 * roles, `rawQuery` is expected to bind its own `?label`/`?subLabel`/`?depiction` directly (the
 * simpler, sh:node-less form) and runs completely unmodified - one HTTP request total.
 *
 * When roles ARE declared, resolving them is a *second*, separate request that batches every
 * `?value` via a single `VALUES` clause (see buildRoleLookupQuery), rather than one query that
 * joins the value-producing SERVICE call against a second role-resolving SERVICE call textually.
 * That matters because Comunica's join planner evaluates a join between a small bindings stream
 * and a SERVICE clause as a bind join - materializing and re-running the SERVICE operation once
 * PER binding on the other side - so e.g. 100 candidate values would mean ~100 extra HTTP requests
 * to the endpoint instead of one. Two requests total (independent of how many values come back) is
 * worth the extra round trip.
 */
export async function runFederatedQuery(
  rawQuery: string,
  propertyShape: PropertyUIElement,
  uiLanguage: string,
): Promise<FederatedResult[]> {
  const labelPaths = labelRolePropertyPaths(propertyShape).map(toSparql);
  const subLabelPaths = subLabelRolePropertyPaths(propertyShape).map(toSparql);
  const depictionPaths = depictionRolePropertyPaths(propertyShape).map(toSparql);

  if (labelPaths.length + subLabelPaths.length + depictionPaths.length === 0) {
    return runRawQuery(rawQuery, propertyShape);
  }

  const values = await runRawQuery(rawQuery, propertyShape);
  if (values.length === 0) return [];

  const lookupQuery = buildRoleLookupQuery(
    values.map(({ term }) => term),
    labelPaths,
    subLabelPaths,
    depictionPaths,
    uiLanguage,
    extractServiceEndpoint(rawQuery),
  );
  const roleResults = await runRawQuery(lookupQuery, propertyShape);
  const roleResultsByValue = new Map(roleResults.map((result) => [result.term.value, result]));

  return values.map(({ term }) => ({ term, ...roleResultsByValue.get(term.value) }));
}

/**
 * Fills in shui:searchQuery's two reserved parameters - `?searchTerm` (what the user typed) and
 * `?uiLanguage` (their interface language) - as literal string values, and appends the LIMIT the
 * spec forbids the query itself from declaring. These aren't real SPARQL variables a query result
 * binds: the spec defines them as parameters the renderer substitutes at execution time (the same
 * idea as e.g. Jena's ParameterizedSparqlString), which is unavoidable here since they're typically
 * used inside a SERVICE block a plain VALUES/BIND join can't reach into.
 */
export function substituteSearchParameters(
  query: string,
  searchTerm: string,
  uiLanguage: string,
): string {
  const substituted = query
    .replace(/\?searchTerm\b/g, `"${escapeSparqlLiteral(searchTerm)}"`)
    .replace(/\?uiLanguage\b/g, `"${escapeSparqlLiteral(uiLanguage)}"`);

  return `${substituted}\nLIMIT ${SEARCH_RESULT_LIMIT}`;
}
