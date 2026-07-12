import { RdfStore } from "rdf-stores";
import type { Environment, RawEnvironment } from "@/environment.ts";

const MODES = ["edit", "view", "facet"] as const;
const BCP47_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;

const isNamedNode = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  (value as { termType?: unknown }).termType === "NamedNode";

// The last, non-removable step of runPreprocessors: whatever a custom chain did, this is the
// actual guard that the result is usable, and the only place a RawEnvironment is asserted into
// a real Environment.
export const assertValidEnvironment = (environment: RawEnvironment): Environment => {
  const errors: string[] = [];

  for (const key of ["shapesGraph", "dataGraph", "scoresGraph"] as const) {
    const value = environment[key];
    if (!(value instanceof RdfStore)) {
      const description = value instanceof URL ? value.href : typeof value;
      errors.push(`${key} must resolve to an RdfStore, got ${description}`);
    }
  }

  if (!isNamedNode(environment.focusNode)) {
    errors.push(`focusNode must be a NamedNode, got ${JSON.stringify(environment.focusNode)}`);
  }

  if (
    !Array.isArray(environment.nodeShapes) ||
    !environment.nodeShapes.every(isNamedNode) ||
    environment.nodeShapes.length === 0
  ) {
    errors.push(
      `nodeShapes must be an array of NamedNodes, got ${JSON.stringify(environment.nodeShapes)}`,
    );
  }

  if (!MODES.includes(environment.mode)) {
    errors.push(`mode must be one of ${MODES.join(", ")}, got ${JSON.stringify(environment.mode)}`);
  }

  for (const key of ["interfaceLanguage", "contentLanguage"] as const) {
    if (typeof environment[key] !== "string" || !BCP47_PATTERN.test(environment[key])) {
      errors.push(`${key} must be a BCP47 language tag, got ${JSON.stringify(environment[key])}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid Environment:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
  }

  // Checked above: the graph fields are RdfStore instances, so this RawEnvironment is a valid Environment.
  return environment as Environment;
};
