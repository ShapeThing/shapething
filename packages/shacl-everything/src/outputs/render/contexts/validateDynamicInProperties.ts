import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { selectQueryFor } from "@/structure/selectQuery.ts";
import {
  FIRST_PROJECTED_VARIABLE,
  insertValuesClause,
  runQuery,
} from "@/outputs/render/hooks/query.ts";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";

/**
 * Validates every property reachable from `nodeShapes`/`focusNode` that declares a dynamic
 * `sh:in [ sh:select "..." ]` (see selectQueryFor) - not via shacl-engine's own generic sh:in
 * evaluation (which pulls the query's *entire* baseline result set just to check membership of one
 * value - see shapesGraphWithoutDynamicIn, which stops shacl-engine from doing that at all), but
 * by re-running that same query with its own projected variable pre-bound to exactly the
 * property's own current NamedNode value(s) (see insertValuesClause) - the same "hand the endpoint
 * a VALUES-bound batch" technique AutoCompleteEditor's filterByInSelectMembership already uses for
 * shui:searchQuery's §10.2 result filtering, applied here to the property's already-set value(s)
 * instead of a widget's search candidates.
 *
 * Only PropertyUIElements are checked - a dynamic sh:in nested inside a node-level sh:or/sh:xone
 * (a ChoiceElement) is out of scope for now, since correctly resolving which branch is active
 * would mean an extra async re-validation per branch inside this already debounced live-validation
 * loop, for a combination with no known real usage yet.
 *
 * Failures are isolated per property (logged, then skipped) so one unreachable/slow federated
 * endpoint never blocks or clears validation results for every other property - mirrors
 * useOptionLookups.tsx/useSelectOptions.tsx's own "log and continue" convention for a failed
 * federated query.
 */
export async function validateDynamicInProperties(
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  nodeShapes: Quad_Subject[],
  focusNode: Quad_Subject,
  corsProxyUrl?: string,
): Promise<ValidationResult[]> {
  const properties = childrenForShape(shapesGraph, dataGraph, nodeShapes, focusNode).filter(
    (element) => element.kind === "property",
  );

  const results: ValidationResult[] = [];

  for (const shape of properties) {
    const query = selectQueryFor(shape);
    if (query === undefined) continue;

    const values = shape
      .getObjects()
      .filter((term): term is NamedNode => term.termType === "NamedNode");
    if (values.length === 0) continue;

    const variable = query.match(FIRST_PROJECTED_VARIABLE)?.[1];
    if (!variable) continue;

    try {
      const rewritten = insertValuesClause(query, variable, values);
      const conforming = await runQuery(rewritten, shape, corsProxyUrl);
      const conformingValues = new Set(conforming.map((result) => result.term.value));
      const severity = shape.get(sh("severity")) ?? sh("Violation");

      for (const value of values) {
        if (conformingValues.has(value.value)) continue;
        results.push({
          focusNode,
          sourceShape: shape.propertyShapes[0],
          value,
          severity,
          message: [
            factory.literal(
              "Value is not among the results of this property's federated sh:in query",
            ),
          ],
        });
      }
    } catch (error) {
      console.error("[shacl-everything] dynamic sh:in validation failed", error);
    }
  }

  return results;
}
