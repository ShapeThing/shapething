import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import type { Environment } from "@/environment.ts";

const MODES = ["edit", "view", "facet"] as const;
const BCP47_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;

const isNamedNode = (value: unknown): boolean =>
  typeof value === "object" && value !== null &&
  (value as { termType?: unknown }).termType === "NamedNode";

export const assertValidEnvironment: Preprocessor = (
  environment: Environment,
) => {
  const errors: string[] = [];

  for (const key of ["shapesGraph", "dataGraph", "scoresGraph"] as const) {
    if (!(environment[key] instanceof RdfStore)) {
      errors.push(
        `${key} must resolve to an RdfStore, got ${String(environment[key])}`,
      );
    }
  }

  if (!isNamedNode(environment.focusNode)) {
    errors.push(
      `focusNode must be a NamedNode, got ${
        JSON.stringify(environment.focusNode)
      }`,
    );
  }

  if (
    !Array.isArray(environment.nodeShapes) ||
    !environment.nodeShapes.every(isNamedNode) ||
    environment.nodeShapes.length === 0
  ) {
    errors.push(
      `nodeShapes must be an array of NamedNodes, got ${
        JSON.stringify(environment.nodeShapes)
      }`,
    );
  }

  if (!MODES.includes(environment.mode)) {
    errors.push(
      `mode must be one of ${MODES.join(", ")}, got ${
        JSON.stringify(environment.mode)
      }`,
    );
  }

  for (const key of ["interfaceLanguage", "contentLanguage"] as const) {
    if (
      typeof environment[key] !== "string" ||
      !BCP47_PATTERN.test(environment[key])
    ) {
      errors.push(
        `${key} must be a BCP47 language tag, got ${
          JSON.stringify(environment[key])
        }`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid Environment:\n${
        errors.map((error) => `  - ${error}`).join("\n")
      }`,
    );
  }

  return environment;
};
