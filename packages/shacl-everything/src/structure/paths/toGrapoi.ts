import type { NamedNode } from "@rdfjs/types";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

type Quantifier = "one" | "oneOrMore" | "zeroOrMore" | "zeroOrOne";

export type GrapoiInstruction = {
  quantifier: Quantifier;
  start: "subject" | "object";
  end: "subject" | "object";
  predicates: NamedNode[];
};

/**
 * Compiles a parsed SHACL property path into the flat instruction list
 * expected by Grapoi's `executeAll`. Grapoi can only repeat a single hop
 * (the same predicate set, in the same direction) some number of times, so
 * a quantifier or alternation can only be compiled when it wraps exactly one
 * resulting instruction. Wrapping a multi-step sequence in a quantifier, or
 * alternating between steps that traverse in different directions or repeat
 * differently, has no equivalent Grapoi instruction list and throws instead
 * of silently producing a differently-behaving path.
 */
export function toGrapoi(path: PropertyPath): GrapoiInstruction[] {
  switch (path.type) {
    case "predicate":
      return [
        {
          quantifier: "one",
          start: "subject",
          end: "object",
          predicates: [path.predicate],
        },
      ];

    case "sequence":
      return path.items.flatMap((item) => toGrapoi(item));

    case "alternative": {
      const branches = path.items.map((item) => toGrapoi(item));

      if (branches.some((instructions) => instructions.length !== 1)) {
        throw new Error(
          "Cannot compile alternative path for Grapoi: each alternative must resolve to a single step, not a sequence",
        );
      }

      const first = branches[0][0];
      if (
        branches.some(
          ([instruction]) => instruction.start !== first.start || instruction.end !== first.end,
        )
      ) {
        throw new Error(
          "Cannot compile alternative path for Grapoi: alternatives must all traverse in the same direction",
        );
      }
      if (branches.some(([instruction]) => instruction.quantifier !== first.quantifier)) {
        throw new Error(
          "Cannot compile alternative path for Grapoi: alternatives must share the same quantifier",
        );
      }

      return [
        {
          quantifier: first.quantifier,
          start: first.start,
          end: first.end,
          predicates: branches.flatMap(([instruction]) => instruction.predicates),
        },
      ];
    }

    case "inverse": {
      const instructions = toGrapoi(path.path);
      return [...instructions].reverse().map((instruction) => ({
        ...instruction,
        start: instruction.end,
        end: instruction.start,
      }));
    }

    case "zeroOrMore":
      return applyQuantifier(toGrapoi(path.path), "zeroOrMore");

    case "oneOrMore":
      return applyQuantifier(toGrapoi(path.path), "oneOrMore");

    case "zeroOrOne":
      return applyQuantifier(toGrapoi(path.path), "zeroOrOne");
  }
}

function applyQuantifier(
  instructions: GrapoiInstruction[],
  quantifier: Quantifier,
): GrapoiInstruction[] {
  if (instructions.length !== 1) {
    throw new Error(
      "Cannot compile path for Grapoi: applying a quantifier to a multi-step sequence is not supported, as Grapoi can only repeat a single step and this would change the path's semantics",
    );
  }

  const [instruction] = instructions;
  return [
    {
      ...instruction,
      quantifier: combineQuantifiers(quantifier, instruction.quantifier),
    },
  ];
}

// e.g. (p+)? and (p?)+ both simplify to p*, so composing any two of these
// quantifiers on a single step always collapses back onto one of the four.
function combineQuantifiers(outer: Quantifier, inner: Quantifier): Quantifier {
  if (inner === "one") {
    return outer;
  }
  if (outer === inner) {
    return outer;
  }
  return "zeroOrMore";
}
